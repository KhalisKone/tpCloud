from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_item():
    with TestClient(app) as client:
        r = client.post("/api/items", json={"label": "test", "value": 1.5})
        assert r.status_code == 201
        item = r.json()
        assert item["label"] == "test"
        assert item["id"] > 0

        r = client.get("/api/items")
        assert r.status_code == 200
        assert any(it["id"] == item["id"] for it in r.json())
