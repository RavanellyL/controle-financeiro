from database import conectar

try:
    with conectar() as conexao:
        with conexao.cursor() as cursor:
            cursor.execute("SELECT version();")
            resultado = cursor.fetchone()
            print("Conexão realizada com sucesso!")
            print(resultado[0])

except Exception as erro:
    print("Erro ao conectar ao PostgreSQL:")
    print(erro)