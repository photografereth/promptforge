# 🔥 Flow Prompt Forge

> **Gerador Inteligente de Prompts de Alta Conversão para Google Flow (Veo 3 & Nano Banana)**  
> *Projetado especificamente para criadores, marcas e agências que produzem criativos para o **TikTok Shop**.*

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-cyan.svg)](https://tailwindcss.com/)
[![Google GenAI](https://img.shields.io/badge/Gemini-3.8%20Flash-orange.svg)](https://ai.google.dev/)
[![TikTok Shop Ready](https://img.shields.io/badge/TikTok%20Shop-Compliant-black.svg)]()

---

## ⚡ O que é o Flow Prompt Forge?

O **Flow Prompt Forge** é uma suíte completa de engenharia de prompts calibrada especificamente para os novos modelos visuais do **Google Flow** — **Veo 3** (geração de vídeo ultra realista cinematográfico) e **Nano Banana** (geração e edição fotográfica 8K).

Diferente de geradores de prompt genéricos, o Flow Prompt Forge resolve o maior desafio de criativos para e-commerce: **consistência visual invariável do produto físico e da criadora**, aliada às regras estritas de conversão e conformidade do **TikTok Shop**.

---

## 🚀 Principais Poderes e Diferenciais

### 1. 🤖 Três Agentes Criativos Especializados
Alterne com um clique entre 3 arquétipos de direção de cena otimizados para o algoritmo do TikTok:

* 👁️ **Agente POV (Ponto de Vista em 1ª Pessoa):**
  * Perspectiva subjetiva direta dos olhos do consumidor.
  * Foco táctil nas mãos interagindo com o produto, abrindo frascos, desembalando e demonstrando texturas.
  * Profundidade de campo sutil (f/1.8) e proximidade sensorial máxima.
* 📱 **Agente UGC (Criador Autêntico / TikTok Shop):**
  * Estética de smartphone 4K natural (sem cara de IA ou plástico).
  * Textura real de pele com microporos visíveis, luz natural e reação espontânea.
  * Gancho visual nos primeiros 2 segundos (**Visual Hook**) e tom de fala amigável.
* 🎬 **Agente Movimento (B-Roll Dinâmico & Comercial):**
  * Movimentos de câmera fluidos e cinematográficos (travelling orbital 360°, slow-motion controlado).
  * Iluminação comercial com reflexos precisos em materiais como vidro, metal e líquidos.

---

### 2. 📸 Galeria Multirreferência com Ancoragem por IA
O Flow Prompt Forge permite anexar **múltiplas fotos** para alimentar a visão computacional do Gemini:

* **Galeria do Produto:** Anexe fotos da frente do frasco, detalhes do rótulo, textura das gotas e embalagem.
* **Galeria da Modelo:** Anexe referências de rosto, expressões faciais e figurino.
* **Galeria de Cenário (Opcional):** Anexe referências de iluminação, ambiente e paleta de cores.
* **Análise Multimodal:** A IA sintetiza todas as fotos e gera automaticamente os atributos visuais invariáveis que devem ser travados em todas as cenas geradas.

---

### 3. 🛡️ Conformidade e Safe Zone do TikTok Shop
* **Safe Zone 9:16 Nativa:** Garante que todo o produto, texto e ganchos visuais fiquem centralizados, sem serem cobertos pelo botão da sacola de compras inferior (`Shopping Bag`) ou pelos botões de curtir/compartilhar da barra lateral direita.
* **Filtro Anti-Claims:** Elimina termos de promessas médicas milagrosas ou cura proibidos pelas diretrizes de comércio (ex: "cura rugas", "emagrecimento imediato", "antes e depois manipulados").
* **Ganchos Visuais Rápidos:** Campos pré-configurados para prender a atenção do usuário nos primeiros 0 a 2 segundos de retenção.

---

### 4. 🎛️ Modos de Geração Vídeo e Imagem
* **Modo Vídeo (Google Veo 3):**
  * Controle milimétrico de duração (4s, 6s, 8s), proporção (9:16 vertical, 16:9 widescreen, 1:1 quadrado).
  * Especificações óticas de lentes reais (24mm, 35mm f/1.8, 50mm, 85mm macro).
  * Efeitos sonoros táteis (SFX), acústica de ambiente e falas naturais.
* **Modo Imagem (Google Nano Banana):**
  * Geração e modo de edição seletiva (`Mudar` vs `Manter`).
  * Iluminação de estúdio, paleta de cores, materiais e composição em terços.

---

### 5. 🧠 Roteador Adaptativo & Alta Resiliência de IA
* Integração com a SDK `@google/genai` utilizando os modelos `gemini-3.8-flash` e `gemini-3.1-flash-lite`.
* Sistema inteligente de contingência (circuit-breaker) para picos de demanda da API (503/High Demand).
* Fallback heurístico inteligente local para garantir que a aplicação continue funcionando mesmo sem internet ou sem chave de API ativa.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend:** React 19, TypeScript, Tailwind CSS v4, Motion, Lucide Icons.
* **Backend:** Node.js, Express, Vite em modo middleware.
* **Inteligência Artificial:** Google GenAI SDK (`@google/genai`).
* **Formatos Suportados:** Google Flow Veo 3 (Video Generation), Google Flow Nano Banana (Image Generation & Inpainting).

---

## 💻 Como Executar Localmente

### Pré-requisitos
* Node.js 20+ ou 22+ instalado
* NPM ou PNPM

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/flow-prompt-forge.git
cd flow-prompt-forge
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:
```env
GEMINI_API_KEY=seu_token_aqui
PORT=3000
```
> *Nota: Você pode obter sua chave de API gratuitamente no [Google AI Studio](https://aistudio.google.com/).*

### 4. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
Acesse a aplicação no navegador em `http://localhost:3000`.

### 5. Compilar para Produção
```bash
npm run build
npm start
```

---

## 📋 Estrutura do Projeto

```
├── index.html                   # Entry point com script defensivo de fetch
├── package.json                 # Scripts e dependências
├── server.ts                    # Servidor Express com rotas de IA multimodal & Vite middleware
├── src/
│   ├── main.tsx                 # Entrada do React
│   ├── App.tsx                  # Componente mestre com layout split e controle de estado
│   ├── types.ts                 # Interfaces TypeScript (Agentes, Âncoras, Referências)
│   ├── index.css                # Estilos globais Tailwind CSS v4
│   └── components/
│       ├── AgentSelector.tsx        # Seletor dos 3 agentes criativos TikTok
│       ├── ReferenceUploadSection.tsx # Galeria multirreferência de fotos e análise multimodal
│       ├── ProductAnchorSection.tsx   # Painel de atributos invariáveis do produto e modelo
│       ├── QuickFillBar.tsx         # Preenchimento rápido de ideias com IA
│       ├── VideoForm.tsx            # Controles de direção de cena (Veo 3)
│       ├── ImageForm.tsx            # Controles fotográficos e de edição (Nano Banana)
│       ├── PromptOutput.tsx         # Visualizador de prompt determinístico & aprimorado
│       └── PromptHistoryModal.tsx   # Histórico local de prompts gerados
```

---

## 🤝 Contribuições

Contribuições da comunidade são super bem-vindas! Sinta-se à vontade para:
1. Abrir uma **Issue** relatando bugs ou sugerindo novos agentes e presets.
2. Enviar um **Pull Request** com melhorias na interface ou novos recursos de direção de cena.

---

## 📄 Licença

Este projeto é disponibilizado sob a licença [MIT](LICENSE). Desenvolvido para a comunidade global de criadores de conteúdo e desenvolvedores de inteligência artificial.
