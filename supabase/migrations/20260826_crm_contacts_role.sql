-- Role belongs on the contact, not in the enrichment blob.
--
-- "Jason, CEO of Ginkgo Bioworks" is how a lead actually arrives, and the title is half of what
-- makes the row worth having. Buried in enrichment jsonb every reader has to know to dig for it;
-- as a column it sorts, filters and displays like the rest of the identity.

alter table crm_contacts add column if not exists role text;
