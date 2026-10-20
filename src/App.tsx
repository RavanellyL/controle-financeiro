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

type Aba = "dashboard" | "relatorios" | "categorias" | "orcamentos" | "investimentos" | "configuracoes";

interface OrcamentoItem {
  categoria: string;
  limite: number;
}

const ORCAMENTOS_PADRAO: OrcamentoItem[] = [
  { categoria: "Alimentação", limite: 1500 },
  { categoria: "Moradia", limite: 2500 },
  { categoria: "Transporte", limite: 800 },
  { categoria: "Lazer", limite: 600 },
  { categoria: "Saúde", limite: 500 },
  { categoria: "Educação", limite: 700 },
  { categoria: "Contas", limite: 1200 },
  { categoria: "Outros", limite: 400 },
];

export default function App() {
  const [token, setToken] = useState<string | null>(obterToken());
  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [emailAuth, setEmailAuth] = useState("");
  const [senhaAuth, setSenhaAuth] = useState("");

  const [abaAtiva, setAbaAtiva] = useState<Aba>("dashboard");

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

  // Estado dos Orçamentos Editáveis (Persistido no localStorage)
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>(() => {
    const salvos = localStorage.getItem("fincontrol_orcamentos");
    return salvos ? JSON.parse(salvos) : ORCAMENTOS_PADRAO;
  });

  const [categoriaEditando, setCategoriaEditando] = useState<string | null>(null);
  const [novoLimiteInput, setNovoLimiteInput] = useState("");

  // ESTADO DO SIMULADOR DE INVESTIMENTOS
  const [aporteInicial, setAporteInicial] = useState("1000");
  const [aporteMensal, setAporteMensal] = useState("500");
  const [taxaJurosAnual, setTaxaJurosAnual] = useState("12"); // 12% ao ano
  const [tempo, setTempo] = useState("5");
  const [tipoTempo, setTipoTempo] = useState<"anos" | "meses">("anos");

  useEffect(() => {
    localStorage.setItem("fincontrol_orcamentos", JSON.stringify(orcamentos));
  }, [orcamentos]);

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
    setAbaAtiva("dashboard");
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

  const despesasPorCategoria = transacoesFiltradas
    .filter((t) => t.tipo === "despesa")
    .reduce((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Number(t.valor);
      return acc;
    }, {} as Record<string, number>);

  function iniciarEdicaoOrcamento(cat: string, limiteAtual: number) {
    setCategoriaEditando(cat);
    setNovoLimiteInput(String(limiteAtual));
  }

  function salvarOrcamento(cat: string) {
    const valorNumerico = Number(novoLimiteInput.replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert("Por favor, informe um valor de meta válido.");
      return;
    }

    setOrcamentos((prev) =>
      prev.map((item) =>
        item.categoria === cat ? { ...item, limite: valorNumerico } : item
      )
    );
    setCategoriaEditando(null);
  }

  // CÁLCULO DOS JUROS COMPOSTOS
  const numMesesTotal = Math.max(1, (tipoTempo === "anos" ? Number(tempo) * 12 : Number(tempo)) || 1);
  const taxaMensal = (Math.pow(1 + (Number(taxaJurosAnual) || 0) / 100, 1 / 12) - 1);

  let acumulado = Number(aporteInicial) || 0;
  let totalInvestido = Number(aporteInicial) || 0;

  for (let m = 1; m <= numMesesTotal; m++) {
    acumulado = (acumulado + (Number(aporteMensal) || 0)) * (1 + taxaMensal);
    totalInvestido += Number(aporteMensal) || 0;
  }

  const totalJuros = Math.max(0, acumulado - totalInvestido);

  const dadosGraficoInvestimento = [
    { nome: "Total Investido", valor: totalInvestido, cor: "#3b82f6" },
    { nome: "Juros Compostos", valor: totalJuros, cor: "#10b981" },
  ];

  // TELA DE AUTENTICAÇÃO
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* SIDEBAR COM NAVEGAÇÃO FUNCIONAL */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
              F
            </div>
            <span className="text-xl font-bold tracking-tight text-white">FinControl</span>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setAbaAtiva("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "dashboard"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Painel
            </button>

            <button
              onClick={() => setAbaAtiva("relatorios")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "relatorios"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              Relatórios
            </button>

            <button
              onClick={() => setAbaAtiva("categorias")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "categorias"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
              Categorias
            </button>

            <button
              onClick={() => setAbaAtiva("orcamentos")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "orcamentos"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Orçamentos
            </button>

            {/* NOVA ABA: INVESTIMENTOS */}
            <button
              onClick={() => setAbaAtiva("investimentos")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "investimentos"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              Investimentos
            </button>

            <button
              onClick={() => setAbaAtiva("configuracoes")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "configuracoes"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Configurações
            </button>
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={fazerLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto space-y-8 overflow-y-auto">
        {/* ABA: PAINEL / DASHBOARD */}
        {abaAtiva === "dashboard" && (
          <>
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
                <h2 className="text-lg font-bold mb-4">Receitas vs. Despesas</h2>
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
                      <Bar dataKey="valor" radius={[12, 12, 0, 0]} barSize={60}>
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
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all text-sm shadow-md shadow-blue-600/20"
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
                        <th className="py-3 px-4 text-left">Descrição</th>
                        <th className="py-3 px-4 text-left">Categoria</th>
                        <th className="py-3 px-4 text-left">Tipo</th>
                        <th className="py-3 px-4 text-left">Data</th>
                        <th className="py-3 px-4 text-right">Valor</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {transacoesFiltradas.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-left">{t.descricao}</td>
                          <td className="py-3.5 px-4 text-slate-400 text-left">{t.categoria}</td>
                          <td className="py-3.5 px-4 text-left">
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
                          <td className="py-3.5 px-4 text-slate-400 text-left">{dataFormatada(t.data)}</td>
                          <td
                            className={`py-3.5 px-4 font-semibold text-right ${
                              t.tipo === "receita" ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {moeda(Number(t.valor))}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button
                              onClick={() => prepararEdicao(t)}
                              title="Editar"
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button
                              onClick={() => excluir(t.id)}
                              title="Excluir"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {/* ABA: RELATÓRIOS */}
        {abaAtiva === "relatorios" && (
          <div className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Relatórios Analíticos</h1>
              <p className="text-slate-400 text-sm mt-1">Análise detalhada das suas despesas organizadas por categoria.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Despesas por Categoria</h2>
                <div className="space-y-4">
                  {Object.keys(despesasPorCategoria).length === 0 ? (
                    <p className="text-slate-400 text-sm">Sem despesas registadas.</p>
                  ) : (
                    Object.entries(despesasPorCategoria).map(([cat, totalCat]) => {
                      const pct = resumoFiltrado.despesas > 0 ? (totalCat / resumoFiltrado.despesas) * 100 : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between text-sm font-medium">
                            <span>{cat}</span>
                            <span className="text-slate-400">{moeda(totalCat)} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold mb-2">Resumo de Atividade</h2>
                  <p className="text-slate-400 text-sm mb-6">Métricas consolidadas com base no histórico atual.</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Total de Transações</span>
                      <span className="font-bold">{transacoesFiltradas.length}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Média por Despesa</span>
                      <span className="font-bold text-rose-400">
                        {moeda(
                          transacoesFiltradas.filter((t) => t.tipo === "despesa").length > 0
                            ? resumoFiltrado.despesas / transacoesFiltradas.filter((t) => t.tipo === "despesa").length
                            : 0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Taxa de Poupança</span>
                      <span className="font-bold text-emerald-400">
                        {resumoFiltrado.receitas > 0
                          ? `${(((resumoFiltrado.receitas - resumoFiltrado.despesas) / resumoFiltrado.receitas) * 100).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA: CATEGORIAS */}
        {abaAtiva === "categorias" && (
          <div className="space-y-6">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Categorias FinControl</h1>
              <p className="text-slate-400 text-sm mt-1">Categorias predefinidas para classificar as suas receitas e despesas.</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {["Trabalho", "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Contas", "Outros"].map((cat) => {
                const num = transacoes.filter((t) => t.categoria === cat).length;
                return (
                  <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">{cat}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{num} {num === 1 ? "transação" : "transações"}</p>
                    </div>
                    <div className="w-9 h-9 bg-blue-600/10 text-blue-400 rounded-xl flex items-center justify-center font-bold text-sm">
                      {cat.slice(0, 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA: ORÇAMENTOS */}
        {abaAtiva === "orcamentos" && (
          <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Orçamentos Mensais</h1>
                <p className="text-slate-400 text-sm mt-1">Defina e edite os seus limites de gastos por categoria em tempo real.</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {orcamentos.map(({ categoria: cat, limite }) => {
                const gasto = despesasPorCategoria[cat] || 0;
                const pct = Math.min((gasto / limite) * 100, 100);
                const estourou = gasto > limite;
                const estaEditando = categoriaEditando === cat;

                return (
                  <div key={cat} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-lg text-white">{cat}</h3>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${estourou ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                        {estourou ? "Limite excedido" : "Dentro do limite"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Gasto: <strong className="text-white">{moeda(gasto)}</strong></span>

                      {estaEditando ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={novoLimiteInput}
                            onChange={(e) => setNovoLimiteInput(e.target.value)}
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                            placeholder="0.00"
                            autoFocus
                          />
                          <button
                            onClick={() => salvarOrcamento(cat)}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1 rounded-lg transition-all"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setCategoriaEditando(null)}
                            className="text-slate-400 hover:text-white text-xs"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Meta: <strong className="text-white">{moeda(limite)}</strong></span>
                          <button
                            onClick={() => iniciarEdicaoOrcamento(cat, limite)}
                            title="Editar Meta"
                            className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-md transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${estourou ? "bg-rose-500" : "bg-blue-500"}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA: INVESTIMENTOS (SIMULADOR DE JUROS COMPOSTOS) */}
        {abaAtiva === "investimentos" && (
          <div className="space-y-8">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Simulador de Investimentos</h1>
              <p className="text-slate-400 text-sm mt-1">Calcule a evolução do seu património acumulado com juros compostos ao longo do tempo.</p>
            </header>

            {/* PAINEL DE RESULTADOS */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Valor Total Acumulado</span>
                <p className="text-3xl font-extrabold text-emerald-400 mt-2">{moeda(acumulado)}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Total Investido (Do seu bolso)</span>
                <p className="text-3xl font-bold text-blue-400 mt-2">{moeda(totalInvestido)}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Total Ganho em Juros</span>
                <p className="text-3xl font-bold text-indigo-400 mt-2">{moeda(totalJuros)}</p>
              </div>
            </section>

            {/* FORMULÁRIO E GRÁFICO */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* FORMULÁRIO DE SIMULAÇÃO */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold">Parâmetros do Investimento</h2>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Aporte Inicial (R$)</label>
                  <input
                    type="number"
                    value={aporteInicial}
                    onChange={(e) => setAporteInicial(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="1000.00"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Aporte Mensal (R$)</label>
                  <input
                    type="number"
                    value={aporteMensal}
                    onChange={(e) => setAporteMensal(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="500.00"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Taxa de Juros Anual (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={taxaJurosAnual}
                    onChange={(e) => setTaxaJurosAnual(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="12.0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Período</label>
                    <input
                      type="number"
                      value={tempo}
                      onChange={(e) => setTempo(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Tipo de Período</label>
                    <select
                      value={tipoTempo}
                      onChange={(e) => setTipoTempo(e.target.value as "anos" | "meses")}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="anos">Anos</option>
                      <option value="meses">Meses</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GRÁFICO DE COMPARAÇÃO */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Investido vs. Juros Acumulados</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGraficoInvestimento} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
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
                      <Bar dataKey="valor" radius={[12, 12, 0, 0]} barSize={60}>
                        {dadosGraficoInvestimento.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES */}
        {abaAtiva === "configuracoes" && (
          <div className="space-y-6 max-w-2xl">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Configurações da Conta</h1>
              <p className="text-slate-400 text-sm mt-1">Gerencie as suas preferências e segurança da conta.</p>
            </header>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold mb-1">Informações do Utilizador</h2>
                <p className="text-xs text-slate-400 mb-4">Sessão ativa protegida por autenticação JWT.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">E-mail Registado</label>
                    <input
                      type="text"
                      disabled
                      value={emailAuth || "Utilizador Ativo"}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800">
                <h2 className="text-base font-bold mb-1 text-rose-400">Zona de Segurança</h2>
                <p className="text-xs text-slate-400 mb-4">Encerrar a sessão corrente de forma segura limpa os tokens do navegador.</p>
                <button
                  onClick={fazerLogout}
                  className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
                >
                  Sair do FinControl
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}