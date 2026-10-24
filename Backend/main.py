import datetime
import os
from datetime import date
from typing import Optional, Literal
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidTokenError
from database import conectar, criar_tabelas
from contextlib import asynccontextmanager

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("A variável de ambiente SECRET_KEY não foi configurada.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabelas()
    yield


app = FastAPI(
    title="Controle Financeiro API",
    openapi_url="/openapi.json",
    docs_url="/docs",
)

@app.exception_handler(RequestValidationError)
async def tratar_erro_validacao(request, exc):
    erros = [
        {
            chave: valor
            for chave, valor in erro.items()
            if chave != "input"
        }
        for erro in exc.errors()
    ]

    return JSONResponse(
        status_code=422,
        content={"detail": erros}
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
class UsuarioCriar(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=8, max_length=128)

class UsuarioResposta(BaseModel):
    id: int
    email: EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str

class TransacaoBase(BaseModel):
    descricao: str = Field(min_length=1, max_length=200)
    categoria: str = Field(min_length=1, max_length=100)
    tipo: Literal["receita", "despesa"]
    valor: float = Field(gt=0, allow_inf_nan=False)
    data: Optional[date] = None

class TransacaoResposta(TransacaoBase):
    id: int
    usuario_id: int

def gerar_hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)

def verificar_senha(senha_plana: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha_plana, senha_hash)

def criar_token_acesso(dados: dict) -> str:
    dados_para_codificar = dados.copy()
    expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    dados_para_codificar.update({"exp": expiracao})
    return jwt.encode(dados_para_codificar, SECRET_KEY, algorithm=ALGORITHM)

def obter_usuario_atual(token: str = Depends(oauth2_scheme)) -> dict:
    excecao_autenticacao = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas ou token expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise excecao_autenticacao
    except InvalidTokenError:
        raise excecao_autenticacao

    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, email FROM usuarios WHERE email = %s", (email,))
            usuario = cursor.fetchone()
            if usuario is None:
                raise excecao_autenticacao
            return usuario

@app.post("/cadastrar", response_model=UsuarioResposta, status_code=status.HTTP_201_CREATED)
def cadastrar_usuario(usuario_dados: UsuarioCriar):
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM usuarios WHERE email = %s", (usuario_dados.email,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Este e-mail já está cadastrado no sistema."
                )
            
            hash_senha = gerar_hash_senha(usuario_dados.senha)
            cursor.execute(
                "INSERT INTO usuarios (email, senha_hash) VALUES (%s, %s) RETURNING id, email",
                (usuario_dados.email, hash_senha)
            )
            novo_usuario = cursor.fetchone()
            conn.commit()
            return novo_usuario

@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, email, senha_hash FROM usuarios WHERE email = %s", (form_data.username,))
            usuario = cursor.fetchone()
            
            if not usuario or not verificar_senha(form_data.password, usuario["senha_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="E-mail ou senha incorretos."
                )
            
            token_acesso = criar_token_acesso(dados={"sub": usuario["email"]})
            return {"access_token": token_acesso, "token_type": "bearer"}

@app.get("/transacoes", response_model=List[TransacaoResposta])
def listar_transacoes(usuario_atual: dict = Depends(obter_usuario_atual)):
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, descricao, categoria, tipo, valor, data::text, usuario_id FROM transacoes WHERE usuario_id = %s",
                (usuario_atual["id"],)
            )
            return cursor.fetchall()

@app.post("/transacoes", response_model=TransacaoResposta, status_code=status.HTTP_201_CREATED)
def criar_transacao(transacao: TransacaoBase, usuario_atual: dict = Depends(obter_usuario_atual)):
    data_transacao = transacao.data if transacao.data else datetime.date.today().isoformat()
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO transacoes (descricao, categoria, tipo, valor, data, usuario_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, descricao, categoria, tipo, valor, data::text, usuario_id
                """,
                (transacao.descricao, transacao.categoria, transacao.tipo, transacao.valor, data_transacao, usuario_atual["id"])
            )
            nova_transacao = cursor.fetchone()
            conn.commit()
            return nova_transacao

@app.put("/transacoes/{transacao_id}", response_model=TransacaoResposta)
def editar_transacao(transacao_id: int, dados: TransacaoBase, usuario_atual: dict = Depends(obter_usuario_atual)):
    data_transacao = dados.data if dados.data else datetime.date.today().isoformat()
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                UPDATE transacoes
                SET descricao = %s, categoria = %s, tipo = %s, valor = %s, data = %s
                WHERE id = %s AND usuario_id = %s
                RETURNING id, descricao, categoria, tipo, valor, data::text, usuario_id
                """,
                (dados.descricao, dados.categoria, dados.tipo, dados.valor, data_transacao, transacao_id, usuario_atual["id"])
            )
            transacao_atualizada = cursor.fetchone()
            if not transacao_atualizada:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Transação não encontrada ou você não tem permissão para alterá-la."
                )
            conn.commit()
            return transacao_atualizada

@app.delete("/transacoes/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_transacao(transacao_id: int, usuario_atual: dict = Depends(obter_usuario_atual)):
    with conectar() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM transacoes WHERE id = %s AND usuario_id = %s RETURNING id",
                (transacao_id, usuario_atual["id"])
            )
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Transação não encontrada ou você não tem permissão para excluí-la."
                )
            conn.commit()
            return None