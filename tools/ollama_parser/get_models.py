import requests
from bs4 import BeautifulSoup


def parse_model_page(url):
    try:

        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        table = soup.find('div', class_='min-w-full divide-y divide-gray-200')
        if not table:
            print(f"No table found on {url}")
            return []

        models_data = []

        rows = table.find_all('div', class_='group')
        for row in rows:
            name_tag = row.find('a', class_='block group-hover:underline text-sm font-medium text-neutral-800')
            name = name_tag.get_text(strip=True) if name_tag else None

            columns = row.find_all('p', class_='col-span-2 text-neutral-500')
            size = columns[0].get_text(strip=True) if len(columns) > 0 else None
            context = columns[1].get_text(strip=True) if len(columns) > 1 else None
            input_type = columns[2].get_text(strip=True) if len(columns) > 2 else None

            if name and size and context and input_type:
                models_data.append({
                    'name': name,
                    'size': size,
                    'context': context,
                    'input': input_type
                })

        return models_data

    except requests.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return []
