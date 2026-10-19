import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
import "./App.css";

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

function App() {
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
      setErro("Sessão expirada ou falha ao conectar com o backend. Faça login novamente.");
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
    const correspondeMes =
      filtroMes === "" || transacao.data.startsWith(filtroMes);

    const correspondeCategoria =
      filtroCategoria === "Todas" ||
      transacao.categoria === filtroCategoria;

    const correspondeTipo =
      filtroTipo === "todos" || transacao.tipo === filtroTipo;

    const correspondeBusca =
      buscaTexto.trim() === "" ||
      transacao.descricao.toLowerCase().includes(buscaTexto.toLowerCase());

    return (
      correspondeMes &&
      correspondeCategoria &&
      correspondeTipo &&
      correspondeBusca
    );
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
    { nome: "Receitas", valor: resumoFiltrado.receitas },
    { nome: "Despesas", valor: resumoFiltrado.despesas },
  ];

  // const despesasPorCategoria = transacoesFiltradas
  //   .filter((transacao) => transacao.tipo === "despesa")
  //   .reduce((grupos, transacao) => {
  //     const categoriaAtual = transacao.categoria;
  //     const valorAtual = Number(transacao.valor);
  //     grupos[categoriaAtual] = (grupos[categoriaAtual] || 0) + valorAtual;
  //     return grupos;
  //   }, {} as Record<string, number>);

  // const dadosCategorias = Object.entries(despesasPorCategoria).map(
  //   ([nome, valor]) => ({ nome, valor })
  // );

  // const dadosCategorias = Object.entries(despesasPorCategoria).map(
  //   ([nome, valor]) => ({ nome, valor })
  // );

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
      setErro("Não foi possível salvar a transação. Tente novamente.");
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

  // TELA DE LOGIN / CADASTRO SE NÃO ESTIVER AUTENTICADO
  if (!token) {
    return (
      <main className="container">
        <header className="cabecalho">
          <h1>Controle Financeiro</h1>
          <p>{modoAuth === "login" ? "Acesse sua conta para continuar." : "Crie sua conta no sistema."}</p>
        </header>

        {erro && <div className="mensagem-erro">{erro}</div>}
        {mensagemSucesso && <div className="mensagem-sucesso">{mensagemSucesso}</div>}

        <section className="painel" style={{ maxWidth: "400px", margin: "20px auto" }}>
          <h2>{modoAuth === "login" ? "Entrar" : "Cadastrar-se"}</h2>
          <form className="formulario" onSubmit={handleAuth}>
            <label>
              E-mail
              <input
                type="email"
                required
                placeholder="seu@email.com"
                value={emailAuth}
                onChange={(e) => setEmailAuth(e.target.value)}
              />
            </label>

            <label>
              Senha
              <input
                type="password"
                required
                placeholder="Sua senha"
                value={senhaAuth}
                onChange={(e) => setSenhaAuth(e.target.value)}
              />
            </label>

            <button type="submit" style={{ marginTop: "10px" }}>
              {modoAuth === "login" ? "Entrar no sistema" : "Criar conta"}
            </button>
          </form>

          <div style={{ marginTop: "15px", textAlign: "center" }}>
            {modoAuth === "login" ? (
              <p>
                Não tem uma conta?{" "}
                <button
                  type="button"
                  className="botao-secundario"
                  onClick={() => { setModoAuth("cadastro"); setErro(""); }}
                >
                  Cadastre-se
                </button>
              </p>
            ) : (
              <p>
                Já possui conta?{" "}
                <button
                  type="button"
                  className="botao-secundario"
                  onClick={() => { setModoAuth("login"); setErro(""); }}
                >
                  Voltar ao login
                </button>
              </p>
            )}
          </div>
        </section>
      </main>
    );
  }

  // TELA DO DASHBOARD APÓS ESTAR LOGADO
  return (
    <main className="container">
      <header className="cabecalho" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Controle Financeiro</h1>
          <p>Organize suas receitas e despesas.</p>
        </div>
        <button type="button" className="botao-excluir" onClick={fazerLogout}>
          Sair da conta
        </button>
      </header>

      {erro && <div className="mensagem-erro">{erro}</div>}

      <section className="resumos">
        <article className="cartao">
          <h3>Receitas</h3>
          <p className="valor receita">{moeda(resumoFiltrado.receitas)}</p>
        </article>

        <article className="cartao">
          <h3>Despesas</h3>
          <p className="valor despesa">{moeda(resumoFiltrado.despesas)}</p>
        </article>

        <article className="cartao">
          <h3>Saldo</h3>
          <p className={`valor ${resumoFiltrado.saldo >= 0 ? "receita" : "despesa"}`}>
            {moeda(resumoFiltrado.saldo)}
          </p>
        </article>
      </section>

      <section className="painel">
        <h2>Visão financeira</h2>
        <div className="grafico">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip formatter={(value) => moeda(Number(value))} />
              <Legend />
              <Bar dataKey="valor" name="Valor" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="painel">
        <h2>
          {editandoId !== null ? "Editar transação" : "Nova transação"}
        </h2>

        <form className="formulario" onSubmit={cadastrarOuEditar}>
          <label>
            Descrição
            <input
              type="text"
              placeholder="Ex.: Salário, aluguel, mercado"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={100}
              required
            />
          </label>

          <label>
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
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
          </label>

          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "receita" | "despesa")}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </label>

          <label>
            Valor (R$)
            <input
              type="number"
              placeholder="0.00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              min="0.01"
              step="0.01"
              required
            />
          </label>

          <label>
            Data (opcional)
            <input
              type="date"
              value={dataTransacao}
              onChange={(e) => setDataTransacao(e.target.value)}
            />
          </label>

          <div className="acoes-formulario">
            <button type="submit" disabled={salvando}>
              {salvando
                ? "Salvando..."
                : editandoId !== null
                  ? "Salvar alterações"
                  : "Cadastrar transação"}
            </button>

            {editandoId !== null && (
              <button type="button" className="botao-secundario" onClick={limparFormulario}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="painel">
        <h2>Transações</h2>

        <div className="filtros">
          <label>
            Buscar por descrição
            <input
              type="text"
              placeholder="Ex.: Mercado, Uber..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
            />
          </label>

          <label>
            Mês
            <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} />
          </label>

          <label>
            Categoria
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="Todas">Todas as categorias</option>
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
          </label>

          <label>
            Tipo
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Receitas e despesas</option>
              <option value="receita">Somente receitas</option>
              <option value="despesa">Somente despesas</option>
            </select>
          </label>

          <button type="button" className="botao-secundario" onClick={limparFiltros}>
            Limpar filtros
          </button>
        </div>

        <p className="contador">{transacoesFiltradas.length} transação(ões) encontrada(s).</p>

        {carregando ? (
          <p>Carregando transações...</p>
        ) : transacoesFiltradas.length === 0 ? (
          <p>Nenhuma transação encontrada com esses filtros.</p>
        ) : (
          <div className="tabela-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transacoesFiltradas.map((transacao) => (
                  <tr key={transacao.id}>
                    <td>{transacao.descricao}</td>
                    <td>{transacao.categoria}</td>
                    <td>
                      <span className={transacao.tipo === "receita" ? "etiqueta receita" : "etiqueta despesa"}>
                        {transacao.tipo === "receita" ? "Receita" : "Despesa"}
                      </span>
                    </td>
                    <td>{dataFormatada(transacao.data)}</td>
                    <td className={transacao.tipo === "receita" ? "receita" : "despesa"}>
                      {moeda(Number(transacao.valor))}
                    </td>
                    <td>
                      <div className="acoes-tabela">
                        <button type="button" className="botao-secundario" onClick={() => prepararEdicao(transacao)}>
                          Editar
                        </button>
                        <button type="button" className="botao-excluir" onClick={() => excluir(transacao.id)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;