import json

import requests
from bs4 import BeautifulSoup

URL = 'https://ollama.com/search'

icon_map = {
    "deepseek": "deepseek.png",
    "mistral": "mistral.png",
    "gemma": "gemma.png",
    "llama": "llama.png",
    "llava": "llava.png",
    "qwen": "qwen.png",

    "hermes": "hermes.jpeg",
    "chatgpt": "chatgpt.png",
    "claude": "claude.png",
    "dolphin": "dolphin.png",
    "gemini": "gemini.png",
    "granite": "granite.png",
    "grok": "grok.png",
    "magicoder": "magicoder.png",
    "phi": "microsoft.png",
    "nomic": "nomic.png",
    "perplexity": "perplexity.png",
    "smollm": "smollm.png",
    "wizard": "wizard.png",
    "yi": "yi.png",
}


def match_icon(title):
    if not title:
        return None
    lowered = title.lower()
    for keyword, filename in icon_map.items():
        if keyword in lowered:
            return f"/images/models/{filename}"
    return None

def extract_size_tags(tags):
    return [tag for tag in tags if tag.lower().endswith("b") and tag[0].isdigit()]

def parse_ollama():
    html = requests.get(URL).content

    soup = BeautifulSoup(html, 'html.parser')

    model_items = soup.find_all('li', {'x-test-model': True})

    # Extract data from each block
    results = []

    for item in model_items:
        # Title
        title = item.find('span', {'x-test-search-response-title': True})
        title_text = title.get_text(strip=True) if title else None

        # Description
        description = item.find('p', class_='max-w-lg')
        description_text = description.get_text(strip=True) if description else None

        # Tags (capability + size)
        capabilities = [tag.get_text(strip=True) for tag in item.find_all('span', {'x-test-capability': True})]
        sizes = [tag.get_text(strip=True) for tag in item.find_all('span', {'x-test-size': True})]
        all_tags = capabilities + sizes

        icon = match_icon(title_text)

        size_tags = extract_size_tags(all_tags)

        models = [f"{title.lower()}:latest"] + [f"{title.lower()}:{size}" for size in size_tags]

        results.append({
            'title': title_text,
            'description': description_text,
            'tags': all_tags,
            'icon': icon,
            'models': models,
            'installed': None
        })

    return results


if __name__ == '__main__':
    results = parse_ollama()

    with open('models.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
