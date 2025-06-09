
'use server';

/**
 * @fileOverview An AI agent that answers questions. If a file (image/document) is provided, it analyzes the file to answer the question.
 * If context text is provided (and no file), it answers based on that context. Otherwise, it acts as a general AI assistant.
 *
 * - answerQuestions - A function that answers questions based on provided file, context, or general knowledge.
 * - AnswerQuestionsInput - The input type for the answerQuestions function.
 * - AnswerQuestionsOutput - The return type for the answerQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerQuestionsInputSchema = z.object({
  fileDataUri: z.string().optional().describe(
    "The file content as a data URI (e.g., for an image or PDF). Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileName: z.string().optional().describe("The name of the attached file, if any."),
  context: z
    .string()
    .optional()
    .describe('Textual context to answer questions about. If not provided and no file is attached, the AI will answer as a general assistant. If a file is attached, this context is ignored.'),
  question: z.string().describe('The question to answer.'),
});
export type AnswerQuestionsInput = z.infer<typeof AnswerQuestionsInputSchema>;

const AnswerQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question, formatted in Markdown.'),
});
export type AnswerQuestionsOutput = z.infer<typeof AnswerQuestionsOutputSchema>;

export async function answerQuestions(input: AnswerQuestionsInput): Promise<AnswerQuestionsOutput> {
  return answerQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerQuestionsPrompt',
  input: {schema: AnswerQuestionsInputSchema},
  output: {schema: AnswerQuestionsOutputSchema},
  prompt: `{{#if fileDataUri}}
You are an AI assistant. Analyze the following document/image named '{{{fileName}}}' and answer the question.
Format your response using Markdown. Use headings, bullet points, tables, and code blocks (specifying the language if known, e.g., \`\`\`javascript ... \`\`\`) where appropriate.

Document/Image:
{{media url=fileDataUri}}

Question: {{{question}}}

{{else if context}}
You are an expert in the subject matter contained in the following study material.

Context: {{{context}}}

Answer the following question based on the study material above.
Format your response using Markdown. Use headings, bullet points, tables, and code blocks (specifying the language if known, e.g., \`\`\`javascript ... \`\`\`) where appropriate. Be clear and concise.

Question: {{{question}}}

{{else}}
You are a helpful AI assistant named StudyBeam. Answer the following question.
Format your response using Markdown. Use headings, bullet points, tables, and code blocks (specifying the language if known, e.g., \`\`\`javascript ... \`\`\`) where appropriate.
If the question is related to studying, learning, or education, provide a more detailed and helpful answer.

Question: {{{question}}}
{{/if}}`,
});

const answerQuestionsFlow = ai.defineFlow(
  {
    name: 'answerQuestionsFlow',
    inputSchema: AnswerQuestionsInputSchema,
    outputSchema: AnswerQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

