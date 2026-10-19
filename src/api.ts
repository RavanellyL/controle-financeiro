const API_URL = "http://localhost:8000";

export interface Transacao {
  id: number;
  descricao: string;
  categoria: string;
  tipo: "receita" | "despesa";
  valor: number;
  data: string;
  usuario_id: number;
}

export type NovaTransacao = Omit<Transacao, "id" | "usuario_id">;

export function obterToken(): string | null {
  return localStorage.getItem("token");
}

export function guardarToken(token: string) {
  localStorage.setItem("token", token);
}

export function removerToken() {
  localStorage.removeItem("token");
}

function cabecalhosAutenticados() {
  const token = obterToken();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

export async function cadastrarUsuario(email: string, senha: str) {
  const resposta = await fetch(`${API_URL}/cadastrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    throw new Error(erro.detail || "Falha ao cadastrar utilizador.");
  }

  return resposta.json();
}

export async function fazerLogin(username: string, password: str) {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  const resposta = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData,
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    throw new Error(erro.detail || "E-mail ou senha incorretos.");
  }

  const dados = await resposta.json();
  guardarToken(dados.access_token);
  return dados.access_token;
}

export async function listarTransacoes(): Promise<Transacao[]> {
  const resposta = await fetch(`${API_URL}/transacoes`, {
    headers: cabecalhosAutenticados(),
  });

  if (!resposta.ok) {
    throw new Error("Erro ao obter transações.");
  }

  return resposta.json();
}

export async function criarTransacao(dados: NovaTransacao): Promise<Transacao> {
  const resposta = await fetch(`${API_URL}/transacoes`, {
    method: "POST",
    headers: cabecalhosAutenticados(),
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error("Erro ao criar transação.");
  }

  return resposta.json();
}

export async function editarTransacao(id: number, dados: NovaTransacao): Promise<Transacao> {
  const resposta = await fetch(`${API_URL}/transacoes/${id}`, {
    method: "PUT",
    headers: cabecalhosAutenticados(),
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    throw new Error("Erro ao atualizar transação.");
  }

  return resposta.json();
}

export async function excluirTransacao(id: number): Promise<void> {
  const resposta = await fetch(`${API_URL}/transacoes/${id}`, {
    method: "DELETE",
    headers: cabecalhosAutenticados(),
  });

  if (!resposta.ok) {
    throw new Error("Erro ao eliminar transação.");
  }
}