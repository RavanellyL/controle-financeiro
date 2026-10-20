import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  listarTransacoes,
  criarTransacao,
  editarTransacao,
  excluirTransacao,
  fazerLogin,
  cadastrarUsuario,
  obterToken,
  removerToken,
  type Transacao,
  type NovaTransacao,
} from "./api";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataFormatada(data: string) {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function App() {
  const [token, setToken] = useState<string | null>(obterToken());
  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [emailAuth, setEmailAuth] = useState("");
  const [senhaAuth, setSenhaAuth] = useState("");

  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("Outros");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [valor, setValor] = useState("");
  const [dataTransacao, setDataTransacao] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [erro, setErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [filtroMes, setFiltroMes] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [buscaTexto, setBuscaTexto] = useState("");

  async function atualizarDados() {
    if (!token) return;
    try {
      const lista = await listarTransacoes();
      setTransacoes(lista);
      setErro("");
    } catch {
      setErro("Sessão expirada ou falha ao conectar com o backend.");
      fazerLogout();
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (token) {
      atualizarDados();
    } else {
      setCarregando(false);
    }
  }, [token]);

  function fazerLogout() {
    removerToken();
    setToken(null);
    setTransacoes([]);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagemSucesso("");

    try {
      if (modoAuth === "cadastro") {
        await cadastrarUsuario(emailAuth, senhaAuth);
        setMensagemSucesso("Cadastro realizado com sucesso! Faça login para continuar.");
        setModoAuth("login");
      } else {
        const tokenRecebido = await fazerLogin(emailAuth, senhaAuth);
        setToken(tokenRecebido);
      }
    } catch (err: any) {
      setErro(err.message || "Falha na autenticação.");
    }
  }

  const transacoesFiltradas = transacoes.filter((transacao) => {
    const correspondeMes = filtroMes === "" || transacao.data.startsWith(filtroMes);
    const correspondeCategoria = filtroCategoria === "Todas" || transacao.categoria === filtroCategoria;
    const correspondeTipo = filtroTipo === "todos" || transacao.tipo === filtroTipo;
    const correspondeBusca =
      buscaTexto.trim() === "" ||
      transacao.descricao.toLowerCase().includes(buscaTexto.toLowerCase());

    return correspondeMes && correspondeCategoria && correspondeTipo && correspondeBusca;
  });

  const resumoFiltrado = transacoesFiltradas.reduce(
    (total, transacao) => {
      const valorNumerico = Number(transacao.valor);
      if (transacao.tipo === "receita") {
        total.receitas += valorNumerico;
      } else {
        total.despesas += valorNumerico;
      }
      total.saldo = total.receitas - total.despesas;
      return total;
    },
    { receitas: 0, despesas: 0, saldo: 0 }
  );

  const dadosGrafico = [
    { nome: "Receitas", valor: resumoFiltrado.receitas, cor: "#10b981" },
    { nome: "Despesas", valor: resumoFiltrado.despesas, cor: "#f43f5e" },
    { nome: "Saldo Total", valor: resumoFiltrado.saldo, cor: "#3b82f6" },
  ];

  function limparFormulario() {
    setDescricao("");
    setCategoria("Outros");
    setTipo("despesa");
    setValor("");
    setDataTransacao("");
    setEditandoId(null);
    setErro("");
  }

  function prepararEdicao(transacao: Transacao) {
    setDescricao(transacao.descricao);
    setCategoria(transacao.categoria);
    setTipo(transacao.tipo);
    setValor(String(transacao.valor));
    setDataTransacao(transacao.data.slice(0, 10));
    setEditandoId(transacao.id);
    setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cadastrarOuEditar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");

    const valorNumerico = Number(valor.replace(",", "."));

    if (!descricao.trim()) {
      setErro("Informe a descrição da transação.");
      return;
    }

    if (!valor.trim() || !Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErro("Informe um valor válido maior que zero.");
      return;
    }

    const dados: NovaTransacao = {
      descricao: descricao.trim(),
      categoria,
      tipo,
      valor: valorNumerico,
      ...(dataTransacao ? { data: dataTransacao } : {}),
    };

    setSalvando(true);

    try {
      if (editandoId !== null) {
        await editarTransacao(editandoId, dados);
      } else {
        await criarTransacao(dados);
      }
      await atualizarDados();
      limparFormulario();
    } catch {
      setErro("Não foi possível salvar a transação.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: number) {
    if (!window.confirm("Tem certeza de que deseja excluir esta transação?")) return;
    setErro("");
    try {
      await excluirTransacao(id);
      await atualizarDados();
    } catch {
      setErro("Não foi possível excluir a transação.");
    }
  }

  function limparFiltros() {
    setFiltroMes("");
    setFiltroCategoria("Todas");
    setFiltroTipo("todos");
    setBuscaTexto("");
  }

  // TELA DE AUTENTICAÇÃO (LOGIN / CADASTRO)
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-blue-500 tracking-tight">FinControl</h1>
            <p className="text-slate-400 text-sm mt-2">
              {modoAuth === "login" ? "Acesse o seu painel financeiro" : "Crie a sua conta em segundos"}
            </p>
          </div>

          {erro && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center">
              {erro}
            </div>
          )}
          {mensagemSucesso && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg text-center">
              {mensagemSucesso}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                E-mail
              </label>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={emailAuth}
                onChange={(e) => setEmailAuth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Senha
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={senhaAuth}
                onChange={(e) => setSenhaAuth(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/30"
            >
              {modoAuth === "login" ? "Entrar na plataforma" : "Criar conta gratuita"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            {modoAuth === "login" ? (
              <p>
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => { setModoAuth("cadastro"); setErro(""); }}
                  className="text-blue-400 font-semibold hover:underline"
                >
                  Registe-se
                </button>
              </p>
            ) : (
              <p>
                Já possui conta?{" "}
                <button
                  type="button"
                  onClick={() => { setModoAuth("login"); setErro(""); }}
                  className="text-blue-400 font-semibold hover:underline"
                >
                  Voltar ao login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // TELA DO DASHBOARD PRINCIPAL
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* BARRA LATERAL (SIDEBAR) */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
              F
            </div>
            <span className="text-xl font-bold tracking-tight text-white">FinControl</span>
          </div>

          <nav className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-400 font-medium rounded-xl border border-blue-500/20">
              Dashboard
            </a>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={fazerLogout}
            className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto space-y-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Visão Geral</h1>
            <p className="text-slate-400 text-sm mt-1">Acompanhe as suas finanças pessoais em tempo real.</p>
          </div>
        </header>

        {erro && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
            {erro}
          </div>
        )}

        {/* CARTÕES DE RESUMO */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Receitas</span>
            <p className="text-3xl font-bold text-emerald-400 mt-2">{moeda(resumoFiltrado.receitas)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Despesas</span>
            <p className="text-3xl font-bold text-rose-400 mt-2">{moeda(resumoFiltrado.despesas)}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Saldo Total</span>
            <p className={`text-3xl font-bold mt-2 ${resumoFiltrado.saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {moeda(resumoFiltrado.saldo)}
            </p>
          </div>
        </section>

        {/* GRÁFICO E FORMULÁRIO */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Balanço Financeiro</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="nome" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.03)" }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#334155",
                      borderRadius: "12px",
                      color: "#f8fafc",
                    }}
                    formatter={(value) => [moeda(Number(value)), "Valor"]}
                  />
                  <Bar dataKey="valor" radius={[12, 12, 0, 0]} barSize={50}>
                    {dadosGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* FORMULÁRIO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">
              {editandoId !== null ? "Editar Transação" : "Nova Transação"}
            </h2>

            <form onSubmit={cadastrarOuEditar} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Ex.: Mercado, Salário..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Trabalho">Trabalho</option>
                    <option value="Moradia">Moradia</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Transporte">Transporte</option>
                    <option value="Saúde">Saúde</option>
                    <option value="Educação">Educação</option>
                    <option value="Lazer">Lazer</option>
                    <option value="Contas">Contas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as "receita" | "despesa")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    step="0.01"
                    min="0.01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Data</label>
                  <input
                    type="date"
                    value={dataTransacao}
                    onChange={(e) => setDataTransacao(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={salvando}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-all text-sm shadow-md"
              >
                {salvando ? "A salvar..." : editandoId !== null ? "Salvar Alterações" : "Adicionar Transação"}
              </button>

              {editandoId !== null && (
                <button
                  type="button"
                  onClick={limparFormulario}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl text-sm transition-all"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </div>
        </section>

        {/* TABELA DE TRANSAÇÕES */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="text-lg font-bold">Histórico de Transações</h2>

            {/* FILTROS */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Buscar por descrição..."
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
              <input
                type="month"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
              />
              <button
                onClick={limparFiltros}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          {carregando ? (
            <p className="text-slate-400 text-sm">A carregar transações...</p>
          ) : transacoesFiltradas.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma transação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase">
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Valor</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transacoesFiltradas.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium">{t.descricao}</td>
                      <td className="py-3.5 px-4 text-slate-400">{t.categoria}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            t.tipo === "receita"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {t.tipo === "receita" ? "Receita" : "Despesa"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{dataFormatada(t.data)}</td>
                      <td
                        className={`py-3.5 px-4 font-semibold ${
                          t.tipo === "receita" ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {moeda(Number(t.valor))}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => prepararEdicao(t)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => excluir(t.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}