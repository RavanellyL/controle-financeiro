from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)

    # Relacionamento: Um usuário pode ter várias transações
    transacoes = relationship("Transacao", back_populates="dono")


class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    categoria = Column(String, nullable=False)
    tipo = Column(String, nullable=False)  # "receita" ou "despesa"
    valor = Column(Float, nullable=False)
    data = Column(String, default=lambda: datetime.date.today().isoformat())

    # Chave estrangeira ligando a transação ao usuário
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    # Relacionamento de volta para o usuário
    dono = relationship("Usuario", back_populates="transacoes")