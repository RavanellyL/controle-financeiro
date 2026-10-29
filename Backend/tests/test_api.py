```python
import uuid

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(autouse=True)
def limpar_banco_de_teste():
    """Limpa somente o banco de dados dedicado aos testes."""
    from database import conectar

    with conectar() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT current_database() AS nome")
            resultado = cur.fetchone()
            nome_banco = resultado["nome"]

            if nome_banco != "controle_financeiro_test":
                pytest.fail(
                    "Limpeza cancelada: o banco conectado é "
                    f"'{nome_banco}', mas era esperado "
                    "'controle_financeiro_test'."
                )

            cur.execute(
                "TRUNCATE TABLE transacoes, usuarios "
                "RESTART IDENTITY CASCADE"
            )

        conn.commit()


@pytest.fixture(scope="module")
def client():
    """Inicia a API de teste e seu ciclo de vida."""
    with TestClient(app) as test_client:
        yield test_client


def criar_usuario(client, senha="SenhaForte123!"):
    """Cadastra um usuário com e-mail exclusivo."""
    email = f"teste_{uuid.uuid4().hex[:12]}@exemplo.com"

    resposta = client.post(
        "/cadastrar",
        json={"email": email, "senha": senha},
    )

    assert resposta.status_code == 201, (
        f"Falha ao cadastrar usuário: "
        f"{resposta.status_code} - {resposta.text}"
    )

    return email, senha


def obter_token(client, email, senha):
    """Autentica um usuário e obtém seu token."""
    resposta = client.post(
        "/login",
        data={"username": email, "password": senha},
    )

    assert resposta.status_code == 200, resposta.text

    dados = resposta.json()
    assert "access_token" in dados

    return dados["access_token"]


def criar_transacao(client, token, dados=None):
    """Cria uma transação autenticada."""
    if dados is None:
        dados = {
            "descricao": "Compra de teste",
            "categoria": "Alimentação",
            "tipo": "despesa",
            "valor": 50.00,
            "data": "2026-10-21",
        }

    return client.post(
        "/transacoes",
        json=dados,
        headers={"Authorization": f"Bearer {token}"},
    )


def obter_transacoes(client, token):
    """Consulta as transações visíveis para um usuário."""
    resposta = client.get(
        "/transacoes",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resposta.status_code == 200, resposta.text

    dados = resposta.json()

    if isinstance(dados, dict):
        dados = dados.get("transacoes", dados.get("items", []))

    return dados


def test_documentacao_api(client):
    resposta = client.get("/docs")
    assert resposta.status_code == 200


def test_transacoes_sem_autenticacao(client):
    resposta = client.get("/transacoes")
    assert resposta.status_code == 401


def test_registrar_usuario(client):
    email, senha = criar_usuario(client)

    assert email.endswith("@exemplo.com")
    assert senha == "SenhaForte123!"


def test_login_usuario(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    assert token


def test_criar_transacao(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(client, token)

    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["descricao"] == "Compra de teste"


def test_usuario_nao_pode_editar_transacao_de_outro(client):
    email1, senha1 = criar_usuario(client)
    token1 = obter_token(client, email1, senha1)

    criada = criar_transacao(client, token1)
    assert criada.status_code == 201, criada.text

    transacao_id = criada.json()["id"]
    descricao_original = criada.json()["descricao"]
    valor_original = float(criada.json()["valor"])

    email2, senha2 = criar_usuario(client)
    token2 = obter_token(client, email2, senha2)

    resposta = client.put(
        f"/transacoes/{transacao_id}",
        json={
            "descricao": "Tentativa de alteração",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": 999.00,
            "data": "2026-10-21",
        },
        headers={"Authorization": f"Bearer {token2}"},
    )

    assert resposta.status_code == 404

    transacoes = obter_transacoes(client, token1)

    original = next(
        (item for item in transacoes if item["id"] == transacao_id),
        None,
    )

    assert original is not None
    assert original["descricao"] == descricao_original
    assert float(original["valor"]) == valor_original


def test_usuario_nao_pode_excluir_transacao_de_outro(client):
    email1, senha1 = criar_usuario(client)
    token1 = obter_token(client, email1, senha1)

    criada = criar_transacao(client, token1)
    assert criada.status_code == 201, criada.text

    transacao_id = criada.json()["id"]
    descricao_original = criada.json()["descricao"]

    email2, senha2 = criar_usuario(client)
    token2 = obter_token(client, email2, senha2)

    resposta = client.delete(
        f"/transacoes/{transacao_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )

    assert resposta.status_code == 404

    transacoes = obter_transacoes(client, token1)

    original = next(
        (item for item in transacoes if item["id"] == transacao_id),
        None,
    )

    assert original is not None
    assert original["descricao"] == descricao_original


def test_senha_curta_e_rejeitada(client):
    resposta = client.post(
        "/cadastrar",
        json={
            "email": f"senha_curta_{uuid.uuid4().hex[:8]}@exemplo.com",
            "senha": "123",
        },
    )

    assert resposta.status_code == 422


def test_tipo_transacao_invalido(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(
        client,
        token,
        {
            "descricao": "Teste inválido",
            "categoria": "Outros",
            "tipo": "tipo_invalido",
            "valor": 10.00,
            "data": "2026-10-21",
        },
    )

    assert resposta.status_code == 422


def test_valor_negativo_rejeitado(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(
        client,
        token,
        {
            "descricao": "Teste negativo",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": -10.00,
            "data": "2026-10-21",
        },
    )

    assert resposta.status_code == 422


def test_descricao_vazia_rejeitada(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(
        client,
        token,
        {
            "descricao": "",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": 10.00,
            "data": "2026-10-21",
        },
    )

    assert resposta.status_code == 422


def test_editar_transacao_com_valor_negativo(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    criada = criar_transacao(client, token)
    assert criada.status_code == 201, criada.text

    transacao_id = criada.json()["id"]
    descricao_original = criada.json()["descricao"]
    valor_original = float(criada.json()["valor"])

    resposta = client.put(
        f"/transacoes/{transacao_id}",
        json={
            "descricao": "Alteração inválida",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": -100.00,
            "data": "2026-10-21",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resposta.status_code == 422

    transacoes = obter_transacoes(client, token)

    original = next(
        (item for item in transacoes if item["id"] == transacao_id),
        None,
    )

    assert original is not None
    assert original["descricao"] == descricao_original
    assert float(original["valor"]) == valor_original


def test_data_invalida_rejeitada(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(
        client,
        token,
        {
            "descricao": "Data inválida",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": 10.00,
            "data": "data-invalida",
        },
    )

    assert resposta.status_code == 422


def test_valor_infinito_rejeitado(client):
    email, senha = criar_usuario(client)
    token = obter_token(client, email, senha)

    resposta = criar_transacao(
        client,
        token,
        {
            "descricao": "Valor infinito",
            "categoria": "Outros",
            "tipo": "despesa",
            "valor": "Infinity",
            "data": "2026-10-21",
        },
    )

    assert resposta.status_code == 422