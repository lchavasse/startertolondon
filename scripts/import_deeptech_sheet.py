#!/usr/bin/env python3.12
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from supabase import create_client

SHEET_ID = '1SBbBEiZO0fV7yw5f7w-eSnSkxxtWk8aiLQz0aJBEbWo'
TOKEN_PATH = Path.home() / '.hermes/google_token.json'
ENV_PATH = Path.home() / '.hermes/.env'


def load_env():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            if k not in __import__('os').environ:
                __import__('os').environ[k] = v


def slugify(value: str) -> str:
    value = re.sub(r'https?://\S+', '', value or '').strip().lower()
    value = re.sub(r'[^a-z0-9]+', '-', value).strip('-')
    return value or 'item'


def compact(*parts: Any) -> str | None:
    cleaned = [str(p).strip() for p in parts if p is not None and str(p).strip()]
    return ' | '.join(cleaned) if cleaned else None


def owner_id(raw: str | None, users: dict[str, str]) -> str | None:
    if not raw:
        return None
    raw = raw.strip().lower()
    aliases = {
        'lc': 'lachlan',
        'lachlan': 'lachlan',
        'barrett': 'barrett',
        'bh': 'barrett',
    }
    mapped = aliases.get(raw)
    return users.get(mapped) if mapped else None


def get_sheet_service():
    data = json.loads(TOKEN_PATH.read_text())
    scopes = data.get('scopes') or []
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), scopes)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('sheets', 'v4', credentials=creds)


def get_rows(service, title: str):
    values = service.spreadsheets().values().get(spreadsheetId=SHEET_ID, range=f"'{title}'!A1:Z999").execute().get('values', [])
    if not values:
        return []
    header = values[0]
    rows = []
    for index, row in enumerate(values[1:], start=2):
        cells = row + [''] * max(0, len(header) - len(row))
        record = {header[i].strip(): cells[i].strip() for i in range(len(header)) if header[i].strip()}
        record['_row'] = index
        if any(v for k, v in record.items() if k != '_row'):
            rows.append(record)
    return rows


def link_source(supabase, entity_type: str, entity_id: str, source_ref: str, source_url: str, metadata: dict[str, Any]):
    existing = supabase.table('crm_source_links').select('id').eq('entity_type', entity_type).eq('source_system', 'sheet').eq('source_ref', source_ref).execute().data
    payload = {
        'entity_type': entity_type,
        'entity_id': entity_id,
        'source_system': 'sheet',
        'source_ref': source_ref,
        'source_url': source_url,
        'metadata': metadata,
        'last_synced_at': datetime.now(timezone.utc).isoformat()
    }
    if existing:
        payload['id'] = existing[0]['id']
        supabase.table('crm_source_links').upsert(payload).execute()
    else:
        supabase.table('crm_source_links').insert(payload).execute()


def find_entity_by_source(supabase, entity_type: str, source_ref: str):
    rows = supabase.table('crm_source_links').select('entity_id').eq('entity_type', entity_type).eq('source_system', 'sheet').eq('source_ref', source_ref).limit(1).execute().data
    return rows[0]['entity_id'] if rows else None


def upsert_org(supabase, source_ref: str, source_url: str, *, name: str, org_type: str, owner_user_id: str | None = None, website: str | None = None, linkedin_url: str | None = None, relationship_summary: str | None = None, notes_freeform: str | None = None):
    entity_id = find_entity_by_source(supabase, 'organisation', source_ref)
    payload = {
        'id': entity_id,
        'name': name,
        'slug': slugify(name),
        'org_type': org_type,
        'owner_user_id': owner_user_id,
        'website': website,
        'linkedin_url': linkedin_url,
        'relationship_summary': relationship_summary,
        'notes_freeform': notes_freeform,
    }
    data = supabase.table('crm_organisations').upsert(payload).execute().data[0]
    link_source(supabase, 'organisation', data['id'], source_ref, source_url, {'name': name})
    return data


def upsert_person(supabase, source_ref: str, source_url: str, *, full_name: str, owner_user_id: str | None = None, title: str | None = None, linkedin_url: str | None = None, relationship_summary: str | None = None, notes_freeform: str | None = None):
    entity_id = find_entity_by_source(supabase, 'person', source_ref)
    payload = {
        'id': entity_id,
        'full_name': full_name,
        'slug': slugify(full_name),
        'owner_user_id': owner_user_id,
        'title': title,
        'linkedin_url': linkedin_url,
        'relationship_summary': relationship_summary,
        'notes_freeform': notes_freeform,
    }
    data = supabase.table('crm_people').upsert(payload).execute().data[0]
    link_source(supabase, 'person', data['id'], source_ref, source_url, {'name': full_name})
    return data


def upsert_opportunity(supabase, source_ref: str, source_url: str, *, title: str, workstream: str, owner_user_id: str | None = None, summary: str | None = None, next_action: str | None = None, notes_freeform: str | None = None, ask_type: str | None = None, priority: str = 'medium', organisations: list[dict[str, Any]] | None = None, people: list[dict[str, Any]] | None = None):
    entity_id = find_entity_by_source(supabase, 'opportunity', source_ref)
    payload = {
        'id': entity_id,
        'title': title,
        'slug': slugify(title),
        'workstream': workstream,
        'owner_user_id': owner_user_id,
        'summary': summary,
        'next_action': next_action,
        'notes_freeform': notes_freeform,
        'ask_type': ask_type,
        'priority': priority if priority in {'urgent', 'high', 'medium', 'low'} else 'medium',
        'status': 'active',
    }
    payload.pop('slug', None)
    data = supabase.table('crm_opportunities').upsert(payload).execute().data[0]
    link_source(supabase, 'opportunity', data['id'], source_ref, source_url, {'title': title})
    supabase.table('crm_opportunity_organisations').delete().eq('opportunity_id', data['id']).execute()
    supabase.table('crm_opportunity_people').delete().eq('opportunity_id', data['id']).execute()
    for organisation in organisations or []:
        supabase.table('crm_opportunity_organisations').insert({'opportunity_id': data['id'], 'organisation_id': organisation['id'], 'role_label': organisation.get('role_label')}).execute()
    for person in people or []:
        supabase.table('crm_opportunity_people').insert({'opportunity_id': data['id'], 'person_id': person['id'], 'role_label': person.get('role_label')}).execute()
    return data


def upsert_task(supabase, source_ref: str, source_url: str, *, title: str, owner_user_id: str | None = None, description: str | None = None, priority: str = 'medium'):
    entity_id = find_entity_by_source(supabase, 'task', source_ref)
    payload = {
        'id': entity_id,
        'title': title,
        'owner_user_id': owner_user_id,
        'description': description,
        'priority': priority if priority in {'urgent', 'high', 'medium', 'low'} else 'medium',
        'status': 'todo',
    }
    data = supabase.table('crm_tasks').upsert(payload).execute().data[0]
    link_source(supabase, 'task', data['id'], source_ref, source_url, {'title': title})
    return data


def main():
    load_env()
    from os import environ
    supabase = create_client(environ['NEXT_PUBLIC_SUPABASE_URL'], environ['SUPABASE_SERVICE_ROLE_KEY'])
    users = {row['slug']: row['id'] for row in supabase.table('crm_users').select('id, slug').execute().data}
    service = get_sheet_service()
    rows_by_tab = {title: get_rows(service, title) for title in ['Sponsors', 'Speakers', 'Expo', 'Community Partners', 'VCs', 'Important People', 'Jobs List']}
    summary = {'organisations': 0, 'people': 0, 'opportunities': 0, 'tasks': 0}

    for tab, rows in rows_by_tab.items():
        for row in rows:
            ref = f'{tab}:{row["_row"]}'
            url = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid=0&range={row["_row"]}:{row["_row"]}'
            if tab == 'Sponsors':
                name = row.get('Banks') or row.get('Notes')
                if not name:
                    continue
                org = upsert_org(supabase, ref, url, name=name, org_type='sponsor', owner_user_id=owner_id(row.get('Owner'), users), relationship_summary=compact(row.get('Status'), row.get('Lead')), notes_freeform=row.get('Notes'))
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'Sponsor: {name}', workstream='sponsor', owner_user_id=owner_id(row.get('Owner'), users), summary=row.get('Notes'), next_action=row.get('Lead'), organisations=[{'id': org['id'], 'role_label': 'target'}], priority='high' if 'high' in (row.get('Status','').lower()) else 'medium')
                summary['organisations'] += 1; summary['opportunities'] += 1
            elif tab == 'VCs':
                name = row.get('Fund')
                if not name:
                    continue
                org = upsert_org(supabase, ref, url, name=name, org_type='vc', owner_user_id=owner_id(row.get('Owner'), users), relationship_summary=compact(row.get('Lead'), row.get('Opportunities')), notes_freeform=row.get('Notes'))
                people = []
                if row.get('Partner'):
                    person = upsert_person(supabase, f'{ref}:partner', url, full_name=row['Partner'], owner_user_id=owner_id(row.get('Owner'), users), linkedin_url=row.get('LI'), relationship_summary=f'Partner at {name}')
                    people.append({'id': person['id'], 'role_label': 'partner'})
                    summary['people'] += 1
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'VC relationship: {name}', workstream='sponsor', owner_user_id=owner_id(row.get('Owner'), users), summary=compact(row.get('Lead'), row.get('Notes')), next_action=row.get('Opportunities'), organisations=[{'id': org['id'], 'role_label': 'fund'}], people=people)
                summary['organisations'] += 1; summary['opportunities'] += 1
            elif tab == 'Speakers':
                company = row.get('Company')
                founder = row.get('Founder')
                if not company and not founder:
                    continue
                org = upsert_org(supabase, ref, url, name=company or founder, org_type='startup', owner_user_id=owner_id(row.get('Owner'), users), relationship_summary=compact(row.get('Pillar'), row.get('Status')), notes_freeform=row.get('Notes')) if company else None
                people = []
                if founder:
                    person = upsert_person(supabase, f'{ref}:founder', url, full_name=founder, owner_user_id=owner_id(row.get('Owner'), users), linkedin_url=row.get('LI'), relationship_summary=compact('Potential speaker', company))
                    people.append({'id': person['id'], 'role_label': 'speaker'})
                    summary['people'] += 1
                organisations = [{'id': org['id'], 'role_label': 'company'}] if org else []
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'Speaker: {founder or company}', workstream='speaker', owner_user_id=owner_id(row.get('Owner'), users), summary=compact(row.get('Pillar'), row.get('Notes')), next_action=row.get('Lead'), organisations=organisations, people=people)
                if org: summary['organisations'] += 1
                summary['opportunities'] += 1
            elif tab == 'Expo':
                company = row.get('Company')
                founder = row.get('Founder / Lead')
                if not company and not founder:
                    continue
                org = upsert_org(supabase, ref, url, name=company or founder, org_type='startup', owner_user_id=owner_id(row.get('Owner'), users), relationship_summary=row.get('Status'), notes_freeform=row.get('Notes')) if company else None
                people = []
                if founder:
                    person = upsert_person(supabase, f'{ref}:lead', url, full_name=founder, owner_user_id=owner_id(row.get('Owner'), users), linkedin_url=row.get('LI'), relationship_summary=compact('Expo lead', company))
                    people.append({'id': person['id'], 'role_label': 'lead'})
                    summary['people'] += 1
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'Expo: {company or founder}', workstream='expo', owner_user_id=owner_id(row.get('Owner'), users), summary=row.get('Notes'), next_action=row.get('Status'), organisations=[{'id': org['id'], 'role_label': 'exhibitor'}] if org else [], people=people)
                if org: summary['organisations'] += 1
                summary['opportunities'] += 1
            elif tab == 'Community Partners':
                name = row.get('community')
                if not name:
                    continue
                org = upsert_org(supabase, ref, url, name=name, org_type='community', owner_user_id=owner_id(row.get('owner'), users), relationship_summary=compact(row.get('status'), row.get('ask')), notes_freeform=compact(row.get('lead'), row.get('wb 6th July')))
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'Community partner: {name}', workstream='community_partner', owner_user_id=owner_id(row.get('owner'), users), summary=row.get('ask'), next_action=row.get('lead'), organisations=[{'id': org['id'], 'role_label': 'partner'}])
                summary['organisations'] += 1; summary['opportunities'] += 1
            elif tab == 'Important People':
                name = row.get('name')
                if not name:
                    continue
                person = upsert_person(supabase, ref, url, full_name=name, title=row.get('role'), linkedin_url=row.get('link'), relationship_summary=row.get('action'), notes_freeform=row.get('ideas'))
                upsert_opportunity(supabase, f'{ref}:opp', url, title=f'Relationship: {name}', workstream='week_ops', summary=row.get('ideas'), next_action=row.get('action'), people=[{'id': person['id'], 'role_label': 'contact'}])
                summary['people'] += 1; summary['opportunities'] += 1
            elif tab == 'Jobs List':
                title = row.get('Column 1')
                if not title:
                    continue
                upsert_task(supabase, ref, url, title=title, owner_user_id=owner_id(row.get('assignee'), users), description=compact(row.get('type'), row.get('notes'), row.get('links')), priority=(row.get('priority') or 'medium').lower())
                summary['tasks'] += 1

    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
