#!/usr/bin/env python3.12
import json
import os
import re
import urllib.request
from pathlib import Path
from supabase import create_client

NOTION_PAGE_ID = '32e5762df40e80bba2eefa09b7d32ff7'
ENV_PATH = Path.home() / '.hermes/.env'
TARGET_PAGES = ['Sponsorship Plan', 'Founders / Companies', 'Working.', '08.07', 'Expo Form']


def load_env():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k, v)


def notion_get(url: str):
    req = urllib.request.Request(url, headers={
        'Authorization': f"Bearer {os.environ['NOTION_API_KEY']}",
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode())


def fetch_children(block_id: str):
    results = []
    url = f'https://api.notion.com/v1/blocks/{block_id}/children?page_size=100'
    while url:
        data = notion_get(url)
        results.extend(data.get('results', []))
        next_cursor = data.get('next_cursor')
        url = f'https://api.notion.com/v1/blocks/{block_id}/children?page_size=100&start_cursor={next_cursor}' if data.get('has_more') else None
    return results


def text_from_rich(rich):
    return ''.join(item.get('plain_text') or item.get('text', {}).get('content', '') for item in (rich or [])).strip()


def slugify(value: str) -> str:
    value = re.sub(r'[^a-z0-9]+', '-', (value or '').lower()).strip('-')
    return value or 'item'


def find_entity_by_source(supabase, entity_type: str, source_ref: str):
    rows = supabase.table('crm_source_links').select('entity_id,id').eq('entity_type', entity_type).eq('source_system', 'notion').eq('source_ref', source_ref).limit(1).execute().data
    return rows[0] if rows else None


def link_source(supabase, entity_type: str, entity_id: str, source_ref: str, source_url: str, metadata: dict):
    existing = find_entity_by_source(supabase, entity_type, source_ref)
    payload = {
        'entity_type': entity_type,
        'entity_id': entity_id,
        'source_system': 'notion',
        'source_ref': source_ref,
        'source_url': source_url,
        'metadata': metadata,
    }
    if existing:
        payload['id'] = existing['id']
        supabase.table('crm_source_links').upsert(payload).execute()
    else:
        supabase.table('crm_source_links').insert(payload).execute()


def workstream_for_page(page: str) -> str:
    mapping = {
        'Sponsorship Plan': 'sponsor',
        'Founders / Companies': 'speaker',
        'Working.': 'week_ops',
        '08.07': 'week_ops',
        'Expo Form': 'expo',
    }
    return mapping.get(page, 'week_ops')


def owner_id(users, page: str):
    return users.get('lachlan') if page in {'Sponsorship Plan', 'Founders / Companies', '08.07'} else None


def main():
    load_env()
    supabase = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    users = {row['slug']: row['id'] for row in supabase.table('crm_users').select('id,slug').execute().data}
    root_children = fetch_children(NOTION_PAGE_ID)
    child_pages = {block['child_page']['title']: block['id'] for block in root_children if block['type'] == 'child_page'}
    summary = {'tasks': 0, 'interactions': 0}

    for page in TARGET_PAGES:
        page_id = child_pages.get(page)
        if not page_id:
            continue
        blocks = fetch_children(page_id)
        page_url = f'https://app.notion.com/{NOTION_PAGE_ID.replace("-", "")}?pvs=4'
        current_heading = None
        for index, block in enumerate(blocks, start=1):
            block_type = block['type']
            if block_type.startswith('heading_'):
                current_heading = text_from_rich(block[block_type].get('rich_text'))
                continue
            if block_type == 'to_do':
                text = text_from_rich(block[block_type].get('rich_text'))
                if not text:
                    continue
                ref = f'{page}:{index}:todo'
                existing = find_entity_by_source(supabase, 'task', ref)
                payload = {
                    'id': existing['entity_id'] if existing else None,
                    'title': text[:160],
                    'description': f'Imported from Notion page {page}' + (f' under {current_heading}' if current_heading else ''),
                    'owner_user_id': owner_id(users, page),
                    'status': 'done' if block[block_type].get('checked') else 'todo',
                    'priority': 'medium',
                }
                task = supabase.table('crm_tasks').upsert(payload).execute().data[0]
                link_source(supabase, 'task', task['id'], ref, page_url, {'page': page, 'heading': current_heading, 'text': text})
                summary['tasks'] += 1
            elif block_type in {'paragraph', 'bulleted_list_item', 'numbered_list_item'}:
                rich = block[block_type].get('rich_text') if block_type != 'paragraph' else block['paragraph'].get('rich_text')
                text = text_from_rich(rich)
                if not text:
                    continue
                ref = f'{page}:{index}:note'
                existing = find_entity_by_source(supabase, 'interaction', ref)
                payload = {
                    'interaction_type': 'manual',
                    'direction': 'internal',
                    'summary': text[:250],
                    'raw_excerpt': text,
                    'source_system': 'notion',
                    'source_external_id': ref,
                    'source_url': page_url,
                    'created_by_user_id': owner_id(users, page),
                }
                if existing:
                    payload['id'] = existing['entity_id']
                    interaction = supabase.table('crm_interactions').upsert(payload).execute().data[0]
                else:
                    interaction = supabase.table('crm_interactions').insert(payload).execute().data[0]
                link_source(supabase, 'interaction', interaction['id'], ref, page_url, {'page': page, 'heading': current_heading})
                summary['interactions'] += 1
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
