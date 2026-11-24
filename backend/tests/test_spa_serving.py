from django.test import Client, override_settings


def test_spa_serves_index_for_root_and_deep_links(tmp_path):
    index_file = tmp_path / "index.html"
    index_file.write_text("<html><div id='root'></div></html>", encoding="utf-8")
    client = Client()

    with override_settings(FRONTEND_DIST_DIR=tmp_path):
        root_response = client.get("/")
        deep_link_response = client.get("/products/42/edit")

    assert root_response.status_code == 200
    assert root_response["Content-Type"].startswith("text/html")
    assert b"<div id='root'></div>" in b"".join(root_response.streaming_content)
    assert deep_link_response.status_code == 200
    assert b"<div id='root'></div>" in b"".join(deep_link_response.streaming_content)


def test_unknown_api_paths_return_json_instead_of_spa(tmp_path):
    index_file = tmp_path / "index.html"
    index_file.write_text("<html>frontend</html>", encoding="utf-8")
    client = Client()

    with override_settings(FRONTEND_DIST_DIR=tmp_path):
        response = client.get("/api/unknown-endpoint/")
        api_root_response = client.get("/api")

    assert response.status_code == 404
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == {"detail": "Not found."}
    assert api_root_response.status_code == 404
    assert api_root_response["Content-Type"].startswith("application/json")
    assert api_root_response.json() == {"detail": "Not found."}


def test_reserved_static_paths_do_not_serve_spa_index(tmp_path):
    index_file = tmp_path / "index.html"
    index_file.write_text("<html>frontend</html>", encoding="utf-8")
    client = Client()

    with override_settings(FRONTEND_DIST_DIR=tmp_path):
        response = client.get("/static/missing.js")

    assert response.status_code == 404
    assert response["Content-Type"].startswith("text/plain")
    assert b"frontend" not in response.content
