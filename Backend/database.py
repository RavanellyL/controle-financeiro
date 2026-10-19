import os
import psycopg
from psycopg.rows import dict_row

# Conexão direta com o PostgreSQL local da tua máquina
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:270324@localhost:5432/controle_financeiro"
)

def conectar():
    return psycopg.connect(
        DATABASE_URL,
        row_factory=dict_row
    )

def criar_tabelas():
    with conectar() as conn:
        with conn.cursor() as cursor:
            # Tabela de utilizadores
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id SERIAL PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    senha_hash VARCHAR(255) NOT NULL
                );
            """)

            # Tabela de transações ligada ao utilizador
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transacoes (
                    id SERIAL PRIMARY KEY,
                    descricao VARCHAR(255) NOT NULL,
                    categoria VARCHAR(100) NOT NULL,
                    tipo VARCHAR(50) NOT NULL,
                    valor NUMERIC(10, 2) NOT NULL,
                    data DATE NOT NULL DEFAULT CURRENT_DATE,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE
                );
            """)
            conn.commit()

if __name__ == "__main__":
    criar_tabelas()
    print("Tabelas criadas com sucesso no PostgreSQL!")