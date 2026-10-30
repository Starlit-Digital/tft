<?php
declare(strict_types=1);

final class SettingsConflict extends RuntimeException {}

function defaultSettings(): array
{
    return json_decode(file_get_contents(__DIR__ . '/../config/settings.json'), true, 64, JSON_THROW_ON_ERROR);
}

function settingText(mixed $value, int $limit, bool $empty = false): string
{
    if (!is_string($value) || strlen($value) > $limit || str_contains($value, "\0") || (!$empty && trim($value) === '')) {
        throw new InvalidArgumentException('Check settings text and its length.');
    }
    return trim($value);
}

function settingId(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[a-z][a-z0-9_]{0,39}$/D', $value)) throw new InvalidArgumentException('Tags need a lowercase letter followed by letters, digits or underscores, up to 40 characters.');
    return $value;
}

function availableTags(array $settings): array
{
    $tags = array_column($settings['fields'], 'id');
    array_push($tags, 'category', 'category.label', 'workgroup.code', 'workgroup.name', 'answers');
    foreach (categories() as $category) foreach ($category['questions'] as $id => $_) $tags[] = 'answers.' . $id;
    return array_values(array_unique($tags));
}

function validateTemplate(string $body, array $tags): void
{
    preg_match_all('/\{\{(.*?)\}\}/s', $body, $matches);
    foreach ($matches[1] as $tag) if (!in_array(trim($tag), $tags, true)) throw new InvalidArgumentException('Unknown output tag: ' . trim($tag));
    $rest = preg_replace('/\{\{.*?\}\}/s', '', $body);
    if (str_contains($rest, '{{') || str_contains($rest, '}}')) throw new InvalidArgumentException('Close every output tag with two braces.');
}

function validateSettings(array $input): array
{
    foreach (['fields' => 40, 'workgroups' => 100, 'formats' => 20] as $key => $max) {
        if (!isset($input[$key]) || !is_array($input[$key]) || !array_is_list($input[$key]) || count($input[$key]) > $max) throw new InvalidArgumentException("Check the $key list and its size.");
    }
    $fields = []; $ids = [];
    foreach ($input['fields'] as $field) {
        if (!is_array($field)) throw new InvalidArgumentException('Choose valid fields.');
        $id = settingId($field['id'] ?? null);
        if (isset($ids[$id]) || in_array($id, ['category', 'answers', 'formatId', 'extra', 'version', 'ticket', 'schema', 'constructor', 'prototype'], true)) throw new InvalidArgumentException('Use unique field tags that are not reserved.');
        $type = $field['type'] ?? '';
        if (!in_array($type, ['text', 'textarea', 'select', 'workgroup'], true) || ($type === 'workgroup' && $id !== 'workgroup') || ($id === 'workgroup' && $type !== 'workgroup')) throw new InvalidArgumentException('Choose a supported field type.');
        if (!is_bool($field['required'] ?? null) || !in_array($field['span'] ?? null, [1, 2], true)) throw new InvalidArgumentException('Choose a field width and required state.');
        $options = $field['options'] ?? [];
        if (!is_array($options) || !array_is_list($options) || count($options) > 50) throw new InvalidArgumentException('Use up to 50 choices.');
        $options = array_map(static fn($v) => settingText($v, 100), $options);
        if (count($options) !== count(array_unique($options)) || ($type === 'select' && !$options)) throw new InvalidArgumentException('Dropdown choices must be unique and not empty.');
        if (in_array($id, ['summary', 'requester'], true) && ($type !== 'text' || !$field['required'])) throw new InvalidArgumentException('Summary and requester remain required text fields.');
        $ids[$id] = true;
        $fields[] = ['id' => $id, 'label' => settingText($field['label'] ?? null, 80), 'type' => $type, 'required' => $field['required'], 'span' => $field['span'], 'options' => $type === 'select' ? $options : []];
    }
    if (!isset($ids['summary'], $ids['requester'])) throw new InvalidArgumentException('Keep summary and requester fields.');
    $workgroups = []; $codes = [];
    foreach ($input['workgroups'] as $group) {
        if (!is_array($group)) throw new InvalidArgumentException('Choose valid workgroups.');
        $code = settingText($group['code'] ?? null, 40);
        if (!preg_match('/^[A-Z0-9][A-Z0-9_-]*$/D', $code) || isset($codes[$code])) throw new InvalidArgumentException('Use unique uppercase workgroup codes.');
        $codes[$code] = true;
        $workgroups[] = ['code' => $code, 'name' => settingText($group['name'] ?? null, 100)];
    }
    $result = ['fields' => $fields, 'workgroups' => $workgroups];
    $formats = []; $formatIds = [];
    foreach ($input['formats'] as $format) {
        if (!is_array($format)) throw new InvalidArgumentException('Choose valid output formats.');
        $id = settingId($format['id'] ?? null);
        if (isset($formatIds[$id])) throw new InvalidArgumentException('Use unique output format IDs.');
        settingText($format['body'] ?? null, 12000);
        $body = $format['body'];
        validateTemplate($body, availableTags($result));
        $formatIds[$id] = true;
        $formats[] = ['id' => $id, 'name' => settingText($format['name'] ?? null, 80), 'body' => $body];
    }
    $default = $input['defaultFormat'] ?? null;
    if (!is_string($default) || !isset($formatIds[$default])) throw new InvalidArgumentException('Choose an existing default output format.');
    return $result + ['formats' => $formats, 'defaultFormat' => $default];
}

final class SettingsStore
{
    public function __construct(private PDO $db)
    {
        $db->exec('CREATE TABLE IF NOT EXISTS settings (scope TEXT PRIMARY KEY, revision INTEGER NOT NULL, document TEXT)');
    }
    private function read(string $scope): array
    {
        $q = $this->db->prepare('SELECT revision, document FROM settings WHERE scope = ?'); $q->execute([$scope]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        return ['revision' => $row ? (int)$row['revision'] : 0, 'config' => $row && $row['document'] !== null ? validateSettings(json_decode($row['document'], true, 64, JSON_THROW_ON_ERROR)) : null];
    }
    public function get(string $workspace, string $scope): array
    {
        if (!in_array($scope, ['user', 'system'], true)) throw new InvalidArgumentException('Choose user or system settings.');
        $system = $this->read('system'); $personal = $this->read('user:' . $workspace);
        $row = $scope === 'system' ? $system : $personal;
        return ['config' => $row['config'] ?? $system['config'] ?? defaultSettings(), 'revision' => $row['revision'], 'systemRevision' => $system['revision'], 'inherited' => $scope === 'user' && $personal['config'] === null, 'scope' => $scope];
    }
    public function save(string $workspace, string $scope, array $body, bool $reset = false): array
    {
        if (!in_array($scope, ['user', 'system'], true) || ($reset && $scope !== 'user')) throw new InvalidArgumentException('Choose a valid settings scope.');
        $config = $reset ? null : validateSettings($body['config'] ?? []);
        if (!is_int($body['revision'] ?? null) || !is_int($body['systemRevision'] ?? null)) throw new InvalidArgumentException('Reload settings before saving.');
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $current = $this->get($workspace, $scope);
            if ($current['revision'] !== $body['revision'] || $current['systemRevision'] !== $body['systemRevision']) throw new SettingsConflict('Settings changed in another window. Reload saved settings before trying again.');
            $key = $scope === 'system' ? 'system' : 'user:' . $workspace;
            $q = $this->db->prepare('INSERT INTO settings VALUES (?, ?, ?) ON CONFLICT(scope) DO UPDATE SET revision=excluded.revision, document=excluded.document');
            $q->execute([$key, $current['revision'] + 1, $config === null ? null : json_encode($config, JSON_THROW_ON_ERROR)]);
            $this->db->exec('COMMIT');
        } catch (Throwable $error) { $this->db->exec('ROLLBACK'); throw $error; }
        return $this->get($workspace, $scope);
    }
}
