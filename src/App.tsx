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

type Aba = "dashboard" | "relatorios" | "categorias" | "orcamentos" | "caixinhas" | "investimentos" | "configuracoes";

interface OrcamentoItem {
  categoria: string;
  limite: number;
}

interface CaixinhaItem {
  id: string;
  nome: string;
  meta: number;
  guardado: number;
  cor: string;
}

interface FechamentoMes {
  id: string;
  mesAno: string;
  receitas: number;
  despesas: number;
  saldo: number;
  dataSalvo: string;
  transacoesSnapshot: Transacao[];
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

const CAIXINHAS_PADRAO: CaixinhaItem[] = [
  { id: "1", nome: "Reserva de Emergência", meta: 10000, guardado: 3500, cor: "bg-emerald-500" },
  { id: "2", nome: "Viagem de Férias", meta: 5000, guardado: 1800, cor: "bg-blue-500" },
  { id: "3", nome: "Troca do Carro", meta: 25000, guardado: 6000, cor: "bg-purple-500" },
];

export default function App() {
  const [token, setToken] = useState<string | null>(obterToken());
  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [emailAuth, setEmailAuth] = useState("");
  const [senhaAuth, setSenhaAuth] = useState("");

  const [abaAtiva, setAbaAtiva] = useState<Aba>("dashboard");

  // PRIVACIDADE / MASCARAR VALORES
  const [ocultarValores, setOcultarValores] = useState<boolean>(() => {
    return localStorage.getItem("fincontrol_ocultar_valores") === "true";
  });

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

  // FILTROS AVANÇADOS DE DATA E BUSCA
  const [filtroPeriodo, setFiltroPeriodo] = useState<"tudo" | "7dias" | "esteMes" | "anoAtual" | "custom">("tudo");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [buscaTexto, setBuscaTexto] = useState("");

  // ESTADO DE ORÇAMENTOS (localStorage)
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>(() => {
    const salvos = localStorage.getItem("fincontrol_orcamentos");
    return salvos ? JSON.parse(salvos) : ORCAMENTOS_PADRAO;
  });
  const [categoriaEditando, setCategoriaEditando] = useState<string | null>(null);
  const [novoLimiteInput, setNovoLimiteInput] = useState("");

  // ESTADO DE CAIXINHAS (localStorage)
  const [caixinhas, setCaixinhas] = useState<CaixinhaItem[]>(() => {
    const salvas = localStorage.getItem("fincontrol_caixinhas");
    return salvas ? JSON.parse(salvas) : CAIXINHAS_PADRAO;
  });
  const [novaCaixinhaNome, setNovaCaixinhaNome] = useState("");
  const [novaCaixinhaMeta, setNovaCaixinhaMeta] = useState("");
  const [valorDepositoMap, setValorDepositoMap] = useState<Record<string, string>>({});

  // HISTÓRICO DE MESES FECHADOS (localStorage)
  const [historicoMeses, setHistoricoMeses] = useState<FechamentoMes[]>(() => {
    const salvos = localStorage.getItem("fincontrol_historico_meses");
    return salvos ? JSON.parse(salvos) : [];
  });
  const [mesSelecionadoModal, setMesSelecionadoModal] = useState<FechamentoMes | null>(null);

  // SIMULADOR DE INVESTIMENTOS
  const [aporteInicial, setAporteInicial] = useState("1000");
  const [aporteMensal, setAporteMensal] = useState("500");
  const [taxaJurosAnual, setTaxaJurosAnual] = useState("12");
  const [tempo, setTempo] = useState("5");
  const [tipoTempo, setTipoTempo] = useState<"anos" | "meses">("anos");

  // CONFIGURAÇÕES DA CONTA, PERFIL E IMAGEM
  const [nomeUsuario, setNomeUsuario] = useState(() => localStorage.getItem("fincontrol_nome_usuario") || "Ravanelly Lima");
  const [cargoUsuario, setCargoUsuario] = useState(() => localStorage.getItem("fincontrol_cargo_usuario") || "Desenvolvedor");
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(() => localStorage.getItem("fincontrol_foto_perfil"));

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState("");
  const [feedbackConfig, setFeedbackConfig] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);

  useEffect(() => {
    localStorage.setItem("fincontrol_orcamentos", JSON.stringify(orcamentos));
  }, [orcamentos]);

  useEffect(() => {
    localStorage.setItem("fincontrol_caixinhas", JSON.stringify(caixinhas));
  }, [caixinhas]);

  useEffect(() => {
    localStorage.setItem("fincontrol_ocultar_valores", String(ocultarValores));
  }, [ocultarValores]);

  useEffect(() => {
    localStorage.setItem("fincontrol_nome_usuario", nomeUsuario);
  }, [nomeUsuario]);

  useEffect(() => {
    localStorage.setItem("fincontrol_cargo_usuario", cargoUsuario);
  }, [cargoUsuario]);

  useEffect(() => {
    if (fotoPerfil) {
      localStorage.setItem("fincontrol_foto_perfil", fotoPerfil);
    } else {
      localStorage.removeItem("fincontrol_foto_perfil");
    }
  }, [fotoPerfil]);

  useEffect(() => {
    localStorage.setItem("fincontrol_historico_meses", JSON.stringify(historicoMeses));
  }, [historicoMeses]);

  function moeda(v: number) {
    if (ocultarValores) return "R$ •••••";
    return v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function dataFormatada(data: string) {
    if (!data) return "";
    const [ano, mes, dia] = data.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }

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

  function handleUploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem selecionada deve ter no máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPerfil(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  function removerFoto() {
    setFotoPerfil(null);
  }

  // LÓGICA DE FILTRAGEM POR PERÍODO PERSONALIZADO
  const transacoesFiltradas = transacoes.filter((t) => {
    const dataTrans = new Date(t.data.slice(0, 10));
    const hoje = new Date();
    
    let correspondePeriodo = true;

    if (filtroPeriodo === "7dias") {
      const limite7Dias = new Date();
      limite7Dias.setDate(hoje.getDate() - 7);
      correspondePeriodo = dataTrans >= limite7Dias && dataTrans <= hoje;
    } else if (filtroPeriodo === "esteMes") {
      correspondePeriodo =
        dataTrans.getMonth() === hoje.getMonth() &&
        dataTrans.getFullYear() === hoje.getFullYear();
    } else if (filtroPeriodo === "anoAtual") {
      correspondePeriodo = dataTrans.getFullYear() === hoje.getFullYear();
    } else if (filtroPeriodo === "custom") {
      if (dataInicio) {
        correspondePeriodo = correspondePeriodo && dataTrans >= new Date(dataInicio);
      }
      if (dataFim) {
        correspondePeriodo = correspondePeriodo && dataTrans <= new Date(dataFim);
      }
    }

    const correspondeCategoria = filtroCategoria === "Todas" || t.categoria === filtroCategoria;
    const correspondeTipo = filtroTipo === "todos" || t.tipo === filtroTipo;
    const correspondeBusca =
      buscaTexto.trim() === "" ||
      t.descricao.toLowerCase().includes(buscaTexto.toLowerCase());

    return correspondePeriodo && correspondeCategoria && correspondeTipo && correspondeBusca;
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
    setFiltroPeriodo("tudo");
    setDataInicio("");
    setDataFim("");
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

  // CAIXINHAS
  function criarCaixinha(e: React.FormEvent) {
    e.preventDefault();
    const metaNum = Number(novaCaixinhaMeta.replace(",", "."));
    if (!novaCaixinhaNome.trim() || isNaN(metaNum) || metaNum <= 0) {
      alert("Informe um nome e uma meta válida.");
      return;
    }

    const cores = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
    const nova: CaixinhaItem = {
      id: String(Date.now()),
      nome: novaCaixinhaNome.trim(),
      meta: metaNum,
      guardado: 0,
      cor: cores[Math.floor(Math.random() * cores.length)],
    };

    setCaixinhas((prev) => [...prev, nova]);
    setNovaCaixinhaNome("");
    setNovaCaixinhaMeta("");
  }

  function depositarCaixinha(id: string) {
    const valorInput = valorDepositoMap[id];
    const valorNum = Number((valorInput || "").replace(",", "."));

    if (isNaN(valorNum) || valorNum <= 0) {
      alert("Informe um valor válido para guardar.");
      return;
    }

    setCaixinhas((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, guardado: item.guardado + valorNum } : item
      )
    );

    setValorDepositoMap((prev) => ({ ...prev, [id]: "" }));
  }

  function excluirCaixinha(id: string) {
    if (!window.confirm("Deseja excluir esta caixinha de objetivo?")) return;
    setCaixinhas((prev) => prev.filter((item) => item.id !== id));
  }

  // HISTÓRICO DE MESES & DOWNLOAD NO COMPUTADOR
  function salvarFechamentoMesAtual() {
    const hoje = new Date();
    const mesAno = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const nomeMesFormatado = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);

    const listaParaSalvar = transacoes.length > 0 ? transacoes : transacoesFiltradas;

    const novoFechamento: FechamentoMes = {
      id: String(Date.now()),
      mesAno: nomeMesFormatado,
      receitas: resumoFiltrado.receitas,
      despesas: resumoFiltrado.despesas,
      saldo: resumoFiltrado.saldo,
      dataSalvo: hoje.toLocaleDateString("pt-BR"),
      transacoesSnapshot: [...listaParaSalvar],
    };

    setHistoricoMeses((prev) => [novoFechamento, ...prev.filter((item) => item.mesAno !== nomeMesFormatado)]);
    alert(`Fechamento de ${nomeMesFormatado} guardado com sucesso com ${listaParaSalvar.length} transação(ões)!`);
  }

  function exportarCSV() {
    if (transacoesFiltradas.length === 0) {
      alert("Nenhuma transação disponível para exportar.");
      return;
    }

    const cabecalho = "ID,Descricao,Categoria,Tipo,Valor,Data\n";
    const linhas = transacoesFiltradas
      .map((t) => `${t.id},"${t.descricao.replace(/"/g, '""')}","${t.categoria}","${t.tipo}",${t.valor},${t.data.slice(0, 10)}`)
      .join("\n");

    const blob = new Blob([cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transacoes_fincontrol_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportarPDF() {
    window.print();
  }

  function exportarDadosJSON() {
    const dadosCompletos = {
      usuario: emailAuth || "Utilizador Ativo",
      dataExportacao: new Date().toISOString(),
      historicoMeses,
      transacoes,
      orcamentos,
      caixinhas,
    };

    const blob = new Blob([JSON.stringify(dadosCompletos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fincontrol_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // JUROS COMPOSTOS
  const numMesesTotal = Math.max(1, (tipoTempo === "anos" ? Number(tempo) * 12 : Number(tempo)) || 1);
  const taxaMensal = Math.pow(1 + (Number(taxaJurosAnual) || 0) / 100, 1 / 12) - 1;

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

  // AÇÕES DAS CONFIGURAÇÕES
  function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackConfig(null);

    if (!senhaAtual) {
      setFeedbackConfig({ tipo: "erro", msg: "Informe a sua senha atual." });
      return;
    }

    if (novaSenha.length < 6) {
      setFeedbackConfig({ tipo: "erro", msg: "A nova senha deve ter no mínimo 6 caracteres." });
      return;
    }

    if (novaSenha !== confirmaNovaSenha) {
      setFeedbackConfig({ tipo: "erro", msg: "A confirmação da nova senha não coincide." });
      return;
    }

    setFeedbackConfig({ tipo: "sucesso", msg: "Senha alterada com sucesso!" });
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmaNovaSenha("");
  }

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
      {/* SIDEBAR COM PERFIL DO USUÁRIO */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between print:hidden">
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
                F
              </div>
              <span className="text-xl font-bold tracking-tight text-white">FinControl</span>
            </div>
          </div>

          {/* PERFIL DO USUÁRIO NA SIDEBAR */}
          <div
            onClick={() => setAbaAtiva("configuracoes")}
            className="mb-6 p-3 bg-slate-950/60 hover:bg-slate-800 border border-slate-800 rounded-2xl flex items-center gap-3 cursor-pointer transition-all group"
          >
            {fotoPerfil ? (
              <img
                src={fotoPerfil}
                alt="Perfil"
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-bold text-base shadow-sm">
                {nomeUsuario.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <h4 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                {nomeUsuario}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">{cargoUsuario}</p>
            </div>
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

            <button
              onClick={() => setAbaAtiva("caixinhas")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 font-semibold rounded-xl transition-all text-left ${
                abaAtiva === "caixinhas"
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              Metas & Caixinhas
            </button>

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
        {/* BOTÃO DE PRIVACIDADE */}
        {abaAtiva !== "configuracoes" && (
          <div className="flex justify-end items-center mb-2 print:hidden">
            <button
              onClick={() => setOcultarValores(!ocultarValores)}
              className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-sm"
              title={ocultarValores ? "Mostrar valores" : "Ocultar valores (Privacidade)"}
            >
              {ocultarValores ? (
                <>
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  <span>Mostrar Valores</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 0110.123 2.937M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 3a9 9 0 01-2.122 3.122m-2.122 2.122L3 3l18 18"/></svg>
                  <span>Ocultar Valores</span>
                </>
              )}
            </button>
          </div>
        )}

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

                  <select
                    value={filtroPeriodo}
                    onChange={(e) => setFiltroPeriodo(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="tudo">Todo o Período</option>
                    <option value="7dias">Últimos 7 dias</option>
                    <option value="esteMes">Este Mês</option>
                    <option value="anoAtual">Ano Atual</option>
                    <option value="custom">Personalizado</option>
                  </select>

                  {filtroPeriodo === "custom" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dataInicio}
                        onChange={(e) => setDataInicio(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">até</span>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={(e) => setDataFim(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                  )}

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
                <p className="text-slate-400 text-sm">Nenhuma transação encontrada para este período.</p>
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

        {/* ABA: RELATÓRIOS & FECHAMENTO MENSAL */}
        {abaAtiva === "relatorios" && (
          <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Relatórios Analíticos</h1>
                <p className="text-slate-400 text-sm mt-1">Análise detalhada das suas despesas e fechamentos guardados.</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={salvarFechamentoMesAtual}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-600/20"
                >
                  + Salvar Mês Atual
                </button>
                <button
                  onClick={exportarCSV}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Exportar CSV
                </button>
                <button
                  onClick={exportarPDF}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-600/20"
                >
                  Exportar PDF
                </button>
              </div>
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

              {/* HISTÓRICO DE MESES GUARDADOS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-bold mb-2">Histórico de Fechamentos Mensais</h2>
                  <p className="text-slate-400 text-sm mb-4">Clique num mês guardado para consultar o extrato detalhado.</p>

                  {historicoMeses.length === 0 ? (
                    <p className="text-slate-500 text-sm">Nenhum mês foi guardado ainda. Clique em "Salvar Mês Atual" acima.</p>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {historicoMeses.map((h) => (
                        <div
                          key={h.id}
                          onClick={() => setMesSelecionadoModal(h)}
                          className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 rounded-xl flex justify-between items-center text-xs cursor-pointer transition-all shadow-sm group"
                        >
                          <div>
                            <span className="font-bold text-white text-sm block group-hover:text-blue-400 transition-colors">
                              {h.mesAno}
                            </span>
                            <span className="text-slate-500">Salvo em {h.dataSalvo}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-emerald-400 block">+ {moeda(h.receitas)}</span>
                            <span className="text-rose-400 block">- {moeda(h.despesas)}</span>
                            <span className={`font-bold mt-0.5 block ${h.saldo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              Saldo: {moeda(h.saldo)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL / FECHAMENTO MENSAL DETALHADO */}
        {mesSelecionadoModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:static print:bg-white print:text-black">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 overflow-y-auto max-h-[85vh] print:bg-white print:border-none print:shadow-none print:max-h-full">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4 print:border-black">
                <div>
                  <h2 className="text-2xl font-bold text-white print:text-black">Fechamento: {mesSelecionadoModal.mesAno}</h2>
                  <p className="text-xs text-slate-400 print:text-gray-600">Guardado em {mesSelecionadoModal.dataSalvo}</p>
                </div>
                <button
                  onClick={() => setMesSelecionadoModal(null)}
                  className="text-slate-400 hover:text-white p-1 text-lg font-bold print:hidden"
                >
                  ✕
                </button>
              </div>

              {/* RESUMO DO MÊS */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl print:border-gray-300 print:bg-gray-50">
                  <span className="text-xs text-slate-400 print:text-gray-600 block uppercase font-semibold">Receitas</span>
                  <span className="text-lg font-bold text-emerald-400 print:text-emerald-700">{moeda(mesSelecionadoModal.receitas)}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl print:border-gray-300 print:bg-gray-50">
                  <span className="text-xs text-slate-400 print:text-gray-600 block uppercase font-semibold">Despesas</span>
                  <span className="text-lg font-bold text-rose-400 print:text-rose-700">{moeda(mesSelecionadoModal.despesas)}</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl print:border-gray-300 print:bg-gray-50">
                  <span className="text-xs text-slate-400 print:text-gray-600 block uppercase font-semibold">Saldo Final</span>
                  <span className={`text-lg font-bold ${mesSelecionadoModal.saldo >= 0 ? "text-emerald-400 print:text-emerald-700" : "text-rose-400 print:text-rose-700"}`}>
                    {moeda(mesSelecionadoModal.saldo)}
                  </span>
                </div>
              </div>

              {/* LISTA DE TRANSAÇÕES DO FECHAMENTO */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-slate-400 print:text-gray-800">Transações Registadas</h3>

                {(!mesSelecionadoModal.transacoesSnapshot || mesSelecionadoModal.transacoesSnapshot.length === 0) ? (
                  <p className="text-xs text-slate-500 print:text-gray-500">Sem registo detalhado para este fechamento.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase print:border-gray-300 print:text-gray-700">
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3">Categoria</th>
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3">Data</th>
                          <th className="py-2 px-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 print:divide-gray-200">
                        {mesSelecionadoModal.transacoesSnapshot.map((t) => (
                          <tr key={t.id} className="print:text-black">
                            <td className="py-2.5 px-3 font-medium">{t.descricao}</td>
                            <td className="py-2.5 px-3 text-slate-400 print:text-gray-600">{t.categoria}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.tipo === "receita" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                                {t.tipo === "receita" ? "Receita" : "Despesa"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 print:text-gray-600">{dataFormatada(t.data)}</td>
                            <td className={`py-2.5 px-3 font-semibold text-right ${t.tipo === "receita" ? "text-emerald-400 print:text-emerald-700" : "text-rose-400 print:text-rose-700"}`}>
                              {moeda(Number(t.valor))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 print:hidden">
                <button
                  onClick={exportarPDF}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Imprimir / Salvar PDF
                </button>
                <button
                  onClick={() => setMesSelecionadoModal(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2 rounded-xl transition-all"
                >
                  Fechar
                </button>
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

        {/* ABA: METAS & CAIXINHAS */}
        {abaAtiva === "caixinhas" && (
          <div className="space-y-8">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Metas de Economia (Caixinhas)</h1>
              <p className="text-slate-400 text-sm mt-1">Crie objetivos financeiros e acompanhe o progresso das suas economias.</p>
            </header>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">Criar Nova Caixinha</h2>
              <form onSubmit={criarCaixinha} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome do Objetivo</label>
                  <input
                    type="text"
                    placeholder="Ex.: Viagem, Casa Própria..."
                    value={novaCaixinhaNome}
                    onChange={(e) => setNovaCaixinhaNome(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Valor Alvo (R$)</label>
                  <input
                    type="number"
                    placeholder="5000.00"
                    value={novaCaixinhaMeta}
                    onChange={(e) => setNovaCaixinhaMeta(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-xl text-sm transition-all shadow-md shadow-blue-600/20"
                  >
                    + Adicionar Meta
                  </button>
                </div>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {caixinhas.map((item) => {
                const pct = Math.min((item.guardado / item.meta) * 100, 100);

                return (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-white">{item.nome}</h3>
                        <button
                          onClick={() => excluirCaixinha(item.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          title="Excluir caixinha"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Guardado: <strong className="text-emerald-400">{moeda(item.guardado)}</strong></span>
                        <span className="text-slate-400">Meta: <strong className="text-white">{moeda(item.meta)}</strong></span>
                      </div>

                      <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.cor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <p className="text-right text-xs text-slate-400 font-medium">{pct.toFixed(1)}% alcançado</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Valor a guardar..."
                        value={valorDepositoMap[item.id] || ""}
                        onChange={(e) =>
                          setValorDepositoMap({ ...valorDepositoMap, [item.id]: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => depositarCaixinha(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded-xl transition-all whitespace-nowrap"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA: INVESTIMENTOS */}
        {abaAtiva === "investimentos" && (
          <div className="space-y-8">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Simulador de Investimentos</h1>
              <p className="text-slate-400 text-sm mt-1">Calcule a evolução do seu património acumulado com juros compostos ao longo do tempo.</p>
            </header>

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

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
          <div className="space-y-8 max-w-4xl">
            <header>
              <h1 className="text-3xl font-bold tracking-tight">Configurações da Conta & Perfil</h1>
              <p className="text-slate-400 text-sm mt-1">Gerencie a sua foto de perfil, nome, preferências e segurança.</p>
            </header>

            {feedbackConfig && (
              <div
                className={`p-4 rounded-xl border text-sm font-medium ${
                  feedbackConfig.tipo === "sucesso"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}
              >
                {feedbackConfig.msg}
              </div>
            )}

            {/* SEÇÃO 1: PERFIL E FOTO DE PERFIL */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Perfil do Utilizador</h2>
                  <p className="text-xs text-slate-400">Personalize o seu nome, função e imagem de perfil</p>
                </div>
              </div>

              {/* UPLOAD DE IMAGEM */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="relative group">
                  {fotoPerfil ? (
                    <img
                      src={fotoPerfil}
                      alt="Perfil"
                      className="w-20 h-20 rounded-full object-cover border-2 border-blue-500 shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 flex items-center justify-center font-black text-2xl shadow-md">
                      {nomeUsuario.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-center sm:text-left">
                  <span className="text-xs font-semibold uppercase text-slate-400 block tracking-wider">Foto de Perfil</span>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <label className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-600/20">
                      <span>Carregar Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadFoto}
                        className="hidden"
                      />
                    </label>

                    {fotoPerfil && (
                      <button
                        onClick={removerFoto}
                        className="bg-slate-800 hover:bg-rose-600/20 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 font-semibold text-xs px-3 py-2 rounded-xl transition-all"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">Formatos aceites: JPG, PNG ou WEBP (máx. 2MB)</p>
                </div>
              </div>

              {/* CAMPOS NOME E CARGO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cargo / Função</label>
                  <input
                    type="text"
                    value={cargoUsuario}
                    onChange={(e) => setCargoUsuario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    placeholder="Ex.: Desenvolvedor, Analista..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">E-mail Registado</label>
                  <input
                    type="text"
                    disabled
                    value={emailAuth || "Utilizador Ativo"}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: SEGURANÇA & ALTERAÇÃO DE SENHA */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Segurança & Autenticação</h2>
                  <p className="text-xs text-slate-400">Atualize as suas credenciais de acesso e valide a proteção da sua conta</p>
                </div>
              </div>

              <form onSubmit={handleAlterarSenha} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Senha Atual</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Nova Senha</label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmaNovaSenha}
                      onChange={(e) => setConfirmaNovaSenha(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-all text-sm shadow-md shadow-blue-600/20"
                  >
                    Atualizar Senha
                  </button>
                </div>
              </form>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>Proteção de Sessão: <strong className="text-emerald-400">Bearer Token JWT (Algoritmo HS256)</strong></span>
                <span className="bg-slate-800 px-2.5 py-1 rounded-md font-mono text-slate-300">Sessão Ativa</span>
              </div>
            </div>

            {/* SEÇÃO 3: PRIVACIDADE & BACKUP DE DADOS */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Privacidade & Exportação de Dados</h2>
                  <p className="text-xs text-slate-400">Obtenha um relatório/backup completo das suas transações e configurações em formato JSON ou CSV</p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-sm text-slate-300">Exportar backup local de dados no PC</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportarCSV}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs transition-all border border-slate-700 flex items-center gap-1.5"
                  >
                    CSV (Excel)
                  </button>
                  <button
                    onClick={exportarDadosJSON}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                  >
                    JSON (Backup)
                  </button>
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: ZONA DE PERIGO */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-rose-400">Zona de Segurança & Encerramento</h2>
                  <p className="text-xs text-slate-400">Encerrar a sessão limpa com segurança os tokens JWT guardados no seu navegador</p>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <button
                  onClick={fazerLogout}
                  className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
                >
                  Encerrar Sessão no FinControl
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}