import requests

url = "http://localhost:8000/assistants/84/chat"
headers = {
    "Authorization": "Bearer sk_live_iEGTLqxmsJ1AfwHGqArwUe7PgRwuPFHZ_BX4h_4VUVg",
    "Content-Type": "application/json"
}
data = {
    "messages": [
        {"role": "user", "content": "Hello!"}
    ]
}

response = requests.post(url, json=data, headers=headers)
print(1111)
print(response.json())