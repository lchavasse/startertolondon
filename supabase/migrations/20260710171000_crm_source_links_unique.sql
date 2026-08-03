create unique index crm_source_links_identity_idx
on crm_source_links(entity_type, source_system, source_ref)
where source_ref is not null;
