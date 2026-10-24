from fastapi.testclient import TestClient
from main import app

import uuid

client = TestClient(app)


def test_api_esta_respondendo():
    resposta = client.get("/docs")
    assert resposta.status_code == 200


def test_listar_transacoes_sem_login():
    resposta = client.get("/transacoes")
    assert resposta.status_code == 401

def test_cadastrar_usuario():
    email = f"teste_{uuid.uuid4().hex[:10]}@exemplo.com"

    resposta = client.post(
        "/cadastrar",
        json={
            "email": email,
            "senha": "SenhaForte123!"
        }
    )

    assert resposta.status_code == 201
    assert resposta.json()["email"] == email
    assert "id" in resposta.json()


def test_login_usuario():
    email = f"login_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    cadastro = client.post(
        "/cadastrar",
        json={
            "email": email,
            "senha": senha
        }
    )

    assert cadastro.status_code == 201

    resposta = client.post(
        "/login",
        data={
            "username": email,
            "password": senha
        }
    )

    assert resposta.status_code == 200
    assert "access_token" in resposta.json()
    assert resposta.json()["token_type"] == "bearer"


def test_crud_transacao():
    email = f"transacao_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    # 1. Criar usuário
    cadastro = client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )
    assert cadastro.status_code == 201

    # 2. Fazer login e obter token
    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )
    assert login.status_code == 200

    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Criar uma transação
    dados = {
        "descricao": "Teste de mercado",
        "categoria": "Alimentação",
        "tipo": "despesa",
        "valor": 100.00,
        "data": "2026-10-21"
    }

    criacao = client.post(
        "/transacoes",
        json=dados,
        headers=headers
    )
    assert criacao.status_code == 201
    transacao_id = criacao.json()["id"]
    assert float(criacao.json()["valor"]) == 100.00

    # 4. Consultar transações
    consulta = client.get("/transacoes", headers=headers)
    assert consulta.status_code == 200
    assert any(
        t["id"] == transacao_id
        for t in consulta.json()
    )

    # 5. Editar a transação
    dados["descricao"] = "Mercado atualizado"
    dados["valor"] = 120.00

    edicao = client.put(
        f"/transacoes/{transacao_id}",
        json=dados,
        headers=headers
    )
    assert edicao.status_code == 200
    assert edicao.json()["descricao"] == "Mercado atualizado"
    assert float(edicao.json()["valor"]) == 120.00

    # 6. Excluir a transação
    exclusao = client.delete(
        f"/transacoes/{transacao_id}",
        headers=headers
    )
    assert exclusao.status_code == 204

    # 7. Confirmar que foi excluída
    consulta_final = client.get("/transacoes", headers=headers)
    assert all(
        t["id"] != transacao_id
        for t in consulta_final.json()
    )


def test_usuario_nao_pode_alterar_transacao_de_outro():
    # Criar dois usuários independentes
    email_a = f"usuario_a_{uuid.uuid4().hex[:10]}@exemplo.com"
    email_b = f"usuario_b_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    for email in [email_a, email_b]:
        resposta = client.post(
            "/cadastrar",
            json={"email": email, "senha": senha}
        )
        assert resposta.status_code == 201

    # Obter token de cada usuário
    def obter_token(email):
        resposta = client.post(
            "/login",
            data={"username": email, "password": senha}
        )
        assert resposta.status_code == 200
        return resposta.json()["access_token"]

    token_a = obter_token(email_a)
    token_b = obter_token(email_b)

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Usuário A cria uma transação
    criacao = client.post(
        "/transacoes",
        json={
            "descricao": "Transação privada",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": 50.00,
            "data": "2026-10-21"
        },
        headers=headers_a
    )
    assert criacao.status_code == 201
    transacao_id = criacao.json()["id"]

    # Usuário B tenta editar a transação de A
    edicao = client.put(
        f"/transacoes/{transacao_id}",
        json={
            "descricao": "Tentativa de invasão",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": 1.00,
            "data": "2026-10-21"
        },
        headers=headers_b
    )
    assert edicao.status_code == 404

    # Usuário B tenta excluir a transação de A
    exclusao = client.delete(
        f"/transacoes/{transacao_id}",
        headers=headers_b
    )
    assert exclusao.status_code == 404

    # Confirmar que a transação continua acessível ao dono
    consulta = client.get("/transacoes", headers=headers_a)
    assert consulta.status_code == 200
    assert any(t["id"] == transacao_id for t in consulta.json())

    # Limpar a transação de teste com o usuário proprietário
    limpeza = client.delete(
        f"/transacoes/{transacao_id}",
        headers=headers_a
    )
    assert limpeza.status_code == 204

def test_cadastro_rejeita_senha_curta():
    resposta = client.post(
        "/cadastrar",
        json={
            "email": f"senha_{uuid.uuid4().hex[:10]}@exemplo.com",
            "senha": "123"
        }
    )

    assert resposta.status_code == 422


def test_transacao_rejeita_tipo_invalido():
    email = f"tipo_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )

    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resposta = client.post(
        "/transacoes",
        json={
            "descricao": "Teste",
            "categoria": "Teste",
            "tipo": "invasao",
            "valor": 10,
            "data": "2026-10-21"
        },
        headers=headers
    )

    assert resposta.status_code == 422


def test_transacao_rejeita_valor_negativo():
    email = f"valor_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )

    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resposta = client.post(
        "/transacoes",
        json={
            "descricao": "Teste",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": -50,
            "data": "2026-10-21"
        },
        headers=headers
    )

    assert resposta.status_code == 422


def test_transacao_rejeita_descricao_vazia():
    email = f"descricao_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )

    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resposta = client.post(
        "/transacoes",
        json={
            "descricao": "",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": 50,
            "data": "2026-10-21"
        },
        headers=headers
    )

    assert resposta.status_code == 422

def test_edicao_rejeita_valor_negativo():
    email = f"edicao_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    cadastro = client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )
    assert cadastro.status_code == 201

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )
    assert login.status_code == 200

    headers = {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }

    criacao = client.post(
        "/transacoes",
        json={
            "descricao": "Compra original",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": 50,
            "data": "2026-10-21"
        },
        headers=headers
    )
    assert criacao.status_code == 201

    transacao_id = criacao.json()["id"]

    edicao = client.put(
        f"/transacoes/{transacao_id}",
        json={
            "descricao": "Tentativa inválida",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": -100,
            "data": "2026-10-21"
        },
        headers=headers
    )

    assert edicao.status_code == 422

    consulta = client.get("/transacoes", headers=headers)
    assert consulta.status_code == 200

    transacao = next(
        t for t in consulta.json()
        if t["id"] == transacao_id
    )
    assert float(transacao["valor"]) == 50.0
    assert transacao["descricao"] == "Compra original"

    limpeza = client.delete(
        f"/transacoes/{transacao_id}",
        headers=headers
    )
    assert limpeza.status_code == 204

def test_transacao_rejeita_data_invalida():
    email = f"data_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    cadastro = client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )
    assert cadastro.status_code == 201

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )
    assert login.status_code == 200

    headers = {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }

    resposta = client.post(
        "/transacoes",
        json={
            "descricao": "Teste de data",
            "categoria": "Teste",
            "tipo": "despesa",
            "valor": 50,
            "data": "2026-99-99"
        },
        headers=headers
    )

    assert resposta.status_code == 422


def test_transacao_rejeita_valor_infinito():
    email = f"infinito_{uuid.uuid4().hex[:10]}@exemplo.com"
    senha = "SenhaForte123!"

    cadastro = client.post(
        "/cadastrar",
        json={"email": email, "senha": senha}
    )
    assert cadastro.status_code == 201

    login = client.post(
        "/login",
        data={"username": email, "password": senha}
    )
    assert login.status_code == 200

    headers = {
        "Authorization": f"Bearer {login.json()['access_token']}"
    }

    resposta = client.post(
        "/transacoes",
        content=(
            b'{"descricao":"Teste de infinito",'
            b'"categoria":"Teste",'
            b'"tipo":"despesa",'
            b'"valor":1e309,'
            b'"data":"2026-10-21"}'
        ),
        headers={
            **headers,
            "Content-Type": "application/json"
        }
    )

    assert resposta.status_code == 422
