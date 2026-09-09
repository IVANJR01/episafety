#!/usr/bin/env bash
#
# Gera um certificado A1 auto-assinado (.pfx) para assinar digitalmente as
# fichas de EPI atraves da funcao "assinar-pdf".
#
# ATENCAO — o que esse certificado e e o que ele NAO e:
#
#   E    -> uma assinatura PAdES criptografica de verdade. Se alguem alterar
#           um byte do PDF depois de assinado, a assinatura quebra e o Adobe
#           Reader acusa. Vale entre as partes (MP 2.200-2, Art. 10, §2).
#
#   NAO E -> certificado ICP-Brasil. O validar.iti.gov.br vai REJEITAR, e o
#           Adobe mostra "identidade do signatario nao verificada". Para ter
#           presuncao de veracidade (Art. 10, §1) so com um A1 pago de uma AC
#           credenciada (Certisign, Serasa, Soluti, Valid, Safeweb).
#
# A chave privada gerada aqui NUNCA deve ser enviada por chat, e-mail ou
# commitada no repositorio. Ela sai desta pasta so para os Secrets do Supabase.
#
# Uso:
#   ./scripts/gerar-certificado-autoassinado.sh
#       -> ja usa o CNPJ do MEI da 3M Cursos e Treinamentos, so pede a senha
#
#   ./scripts/gerar-certificado-autoassinado.sh --cnpj 12.345.678/0001-95 \
#       --razao-social "OUTRA EMPRESA" --nome-fantasia "OUTRA" \
#       --email contato@empresa.com
#
set -euo pipefail

# Padroes do MEI da 3M Cursos e Treinamentos, conferidos no CCMEI emitido pela
# Receita em 19/07/2023. Sao dados publicos; a chave privada nunca fica aqui.
# Passe --cnpj / --razao-social para gerar para outra empresa.
CNPJ="51.489.453/0001-64"
RAZAO="51.489.453 JOSE IVAN HOLANDA DE MELO JUNIOR"
FANTASIA="3M CURSOS E TREINAMENTOS"
EMAIL=""
SENHA=""
ANOS=3
SAIDA="certificado.pfx"

while [ $# -gt 0 ]; do
  case "$1" in
    --cnpj)          CNPJ="${2:-}"; shift 2 ;;
    --razao-social)  RAZAO="${2:-}"; shift 2 ;;
    --nome-fantasia) FANTASIA="${2:-}"; shift 2 ;;
    --email)         EMAIL="${2:-}"; shift 2 ;;
    --senha)         SENHA="${2:-}"; shift 2 ;;
    --anos)          ANOS="${2:-}"; shift 2 ;;
    --saida)         SAIDA="${2:-}"; shift 2 ;;
    -h|--help)       sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Opcao desconhecida: $1" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------- validacoes

# Confere os dois digitos verificadores do CNPJ. Um CNPJ errado nao quebra a
# assinatura, mas fica gravado dentro do certificado para sempre — melhor
# barrar aqui do que descobrir depois de assinar cem fichas.
cnpj_valido() {
  local d="$1" i soma resto dig1 dig2
  [ "${#d}" -eq 14 ] || return 1
  # Rejeita 00000000000000, 11111111111111, etc.
  [ -z "$(echo "$d" | sed "s/${d:0:1}//g")" ] && return 1

  local pesos1=(5 4 3 2 9 8 7 6 5 4 3 2)
  soma=0
  for i in $(seq 0 11); do
    soma=$(( soma + ${d:$i:1} * ${pesos1[$i]} ))
  done
  resto=$(( soma % 11 ))
  dig1=$(( resto < 2 ? 0 : 11 - resto ))
  [ "$dig1" -eq "${d:12:1}" ] || return 1

  local pesos2=(6 5 4 3 2 9 8 7 6 5 4 3 2)
  soma=0
  for i in $(seq 0 12); do
    soma=$(( soma + ${d:$i:1} * ${pesos2[$i]} ))
  done
  resto=$(( soma % 11 ))
  dig2=$(( resto < 2 ? 0 : 11 - resto ))
  [ "$dig2" -eq "${d:13:1}" ] || return 1

  return 0
}

if [ -z "$CNPJ" ]; then
  [ -t 0 ] || { echo "ERRO: sem terminal para perguntar. Use --cnpj." >&2; exit 1; }
  read -r -p "CNPJ do MEI/empresa: " CNPJ
fi
CNPJ_DIGITOS="$(echo "$CNPJ" | tr -cd '0-9')"

if ! cnpj_valido "$CNPJ_DIGITOS"; then
  echo "ERRO: CNPJ invalido (digitos verificadores nao batem): $CNPJ" >&2
  exit 1
fi

if [ -z "$RAZAO" ]; then
  [ -t 0 ] || { echo "ERRO: sem terminal para perguntar. Use --razao-social." >&2; exit 1; }
  read -r -p "Razao social (como deve aparecer na assinatura): " RAZAO
fi
[ -n "$RAZAO" ] || { echo "ERRO: razao social e obrigatoria." >&2; exit 1; }

# Sem nome fantasia o campo O do certificado repete a razao social.
[ -n "$FANTASIA" ] || FANTASIA="$RAZAO"

# So pergunta o que e opcional quando ha alguem para responder. Rodando sem
# terminal (CI, script chamando script) a pergunta ficaria esperando para
# sempre, e o e-mail nao e obrigatorio para gerar o certificado.
if [ -z "$EMAIL" ] && [ -t 0 ]; then
  read -r -p "E-mail (opcional, Enter para pular): " EMAIL || true
fi

if [ -z "$SENHA" ]; then
  [ -t 0 ] || { echo "ERRO: sem terminal para perguntar. Use --senha." >&2; exit 1; }
  read -r -s -p "Senha para proteger o .pfx: " SENHA; echo
  read -r -s -p "Repita a senha: " SENHA2; echo
  [ "$SENHA" = "$SENHA2" ] || { echo "ERRO: as senhas nao conferem." >&2; exit 1; }
fi
[ -n "$SENHA" ] || { echo "ERRO: a senha nao pode ser vazia." >&2; exit 1; }

# ------------------------------------------------------------------ geracao

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

# O formato "RAZAO SOCIAL:CNPJ" no CN e o mesmo que a ICP-Brasil usa nos
# e-CNPJ, e e o texto que o Adobe Reader mostra como nome do signatario.
{
  echo '[req]'
  echo 'distinguished_name = dn'
  echo 'prompt = no'
  echo 'x509_extensions = v3'
  echo
  echo '[dn]'
  echo 'C = BR'
  echo "O = ${FANTASIA}"
  echo "CN = ${RAZAO}:${CNPJ_DIGITOS}"
  echo
  echo '[v3]'
  echo 'basicConstraints = critical,CA:FALSE'
  echo 'keyUsage = critical,digitalSignature,nonRepudiation'
  echo 'extendedKeyUsage = emailProtection'
  echo 'subjectKeyIdentifier = hash'
  echo 'subjectAltName = @san'
  echo
  echo '[san]'
  # 2.16.76.1.3.3 e o OID da ICP-Brasil que carrega o CNPJ do titular.
  echo "otherName = 2.16.76.1.3.3;UTF8:${CNPJ_DIGITOS}"
  [ -n "$EMAIL" ] && echo "email = ${EMAIL}"
} > "$TMP/openssl.cnf"

DIAS=$(( ANOS * 365 ))

openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
  -days "$DIAS" \
  -config "$TMP/openssl.cnf" \
  -keyout "$TMP/chave.pem" \
  -out "$TMP/cert.pem" 2>/dev/null

# -legacy / PBE-SHA1-3DES: o node-forge (usado pelo @signpdf/signer-p12) nao
# le PKCS#12 cifrado com AES-256/PBKDF2, que e o padrao do OpenSSL 3. Sem
# isso o .pfx e gerado, mas a funcao assinar-pdf nao consegue abrir.
openssl pkcs12 -export \
  -inkey "$TMP/chave.pem" \
  -in "$TMP/cert.pem" \
  -name "$FANTASIA" \
  -certpbe PBE-SHA1-3DES \
  -keypbe PBE-SHA1-3DES \
  -macalg sha1 \
  -passout "pass:${SENHA}" \
  -out "$SAIDA"

chmod 600 "$SAIDA"
base64 -w 0 "$SAIDA" > "${SAIDA}.base64" 2>/dev/null || base64 "$SAIDA" | tr -d '\n' > "${SAIDA}.base64"
chmod 600 "${SAIDA}.base64"

VALIDADE="$(openssl x509 -in "$TMP/cert.pem" -noout -enddate | cut -d= -f2)"

cat <<TXT

Certificado gerado.

  arquivo .pfx : ${SAIDA}
  base64       : ${SAIDA}.base64
  titular      : ${RAZAO}:${CNPJ_DIGITOS}
  organizacao  : ${FANTASIA}
  valido ate   : ${VALIDADE}

Proximos passos, no painel do Supabase
(Project Settings -> Edge Functions -> Secrets):

  CERT_A1_PFX_BASE64  = conteudo de ${SAIDA}.base64 (uma linha so)
  CERT_A1_SENHA       = a senha que voce acabou de digitar

Depois disso a ficha de EPI passa a sair assinada automaticamente.

Guarde o .pfx em lugar seguro e NAO commite no repositorio. Quem tem esse
arquivo mais a senha assina em nome da empresa.
TXT
