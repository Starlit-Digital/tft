# Historical datastore findings

The recovered application used MySQL through a shared PHP database wrapper. The formatter's AJAX location lookup joined locations, site codes, workgroups and business units. The repository contains no original database connection settings or record exports.

Configuration declares 20 table roles: accounts, agencies, asset tags, business units, callbacks, clients, contacts, escalations, history, keywords, locations, reference documents, reference document types, resolvers, site codes, tickets, timeframes, trends, workgroups and workgroup types. Some library functions reference additional or inconsistent table constants. These are source references, not a recovered authoritative schema.

The ticket library includes retrieval, search, save and trend functions. Function presence alone does not establish that every path was deployed or complete. Generic equivalents should be specified and tested rather than copied directly.

A historical application catalog spreadsheet was found in the escalation area. It has one populated sheet, 327 rows including its header and six columns, plus two empty sheets. Its fields describe application identity, description, support routing, service classification and tier. This is a useful reference for a future generic application directory, but is not the ticket database. Original contents stay outside Git.

Text snippets and issue templates are also embedded directly in the formatter JavaScript, so not all of the workflow came from the database.

No matching application database dump was found in the recovered project folder, its nested historical ZIP, the older server archive or the two personal site archives checked. Available standalone SQL backup filenames were inspected; the likely general site backup had no exact matches for the expected core table names. This is a bounded search, not proof that no dump exists elsewhere.

Next: recover a matching schema or dump if available, inspect only in private local storage, map useful structures and create entirely fictional seed data. Do not import real tickets, directory records, routing addresses or credentials.
