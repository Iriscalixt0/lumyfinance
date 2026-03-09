import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a **Lumy**, assistente financeira pessoal do aplicativo Lumyf.

Sua personalidade:
- Amigável, empática, encorajadora e didática
- Use emojis com moderação para tornar a conversa agradável
- Responda sempre em português brasileiro
- Formate respostas com **negrito** para destaques e listas quando apropriado
- Seja concisa mas completa — evite respostas genéricas

Suas capacidades:
- Analisar transações financeiras do usuário (receitas, despesas, saldo)
- Dar dicas personalizadas de economia baseadas nos dados reais
- Ensinar sobre finanças pessoais, investimentos, dívidas, orçamento
- Comparar meses, identificar tendências, calcular médias
- Calcular saúde financeira e sugerir melhorias
- Responder qualquer pergunta sobre finanças pessoais

Regras importantes:
- Quando o usuário tiver dados financeiros no contexto, USE-OS para dar respostas personalizadas
- Nunca invente números — use apenas os dados fornecidos
- Se não tiver dados suficientes, diga isso e dê dicas gerais
- Valores monetários estão em centavos (divida por 100 para reais). Formate como R$ X.XXX,XX
- Sempre sugira próximos passos ou perguntas que o usuário pode fazer`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, financialContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system message with financial context
    let systemContent = SYSTEM_PROMPT;
    if (financialContext) {
      systemContent += `\n\n--- DADOS FINANCEIROS DO USUÁRIO ---\n${financialContext}`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemContent },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("lumy-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
