#!/usr/bin/env python3.12
import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SHEET_ID = '1SBbBEiZO0fV7yw5f7w-eSnSkxxtWk8aiLQz0aJBEbWo'
TABS = ['Sponsors', 'Speakers', 'Expo', 'Community Partners', 'VCs', 'Important People', 'Jobs List']
TOKEN_PATH = Path.home() / '.hermes/google_token.json'


def get_service():
    raw = json.loads(TOKEN_PATH.read_text())
    scopes = raw.get('scopes') or []
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
    for row_index, row in enumerate(values[1:], start=2):
        cells = row + [''] * max(0, len(header) - len(row))
        mapped = {header[i].strip(): cells[i].strip() for i in range(len(header)) if header[i].strip()}
        if any(mapped.values()):
            mapped['_row'] = row_index
            rows.append(mapped)
    return rows


def main():
    service = get_service()
    print(json.dumps({tab: get_rows(service, tab) for tab in TABS}, ensure_ascii=False))


if __name__ == '__main__':
    main()
