
'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating study materials from uploaded lecture notes.
 *
 * - generateStudyMaterials - A function that takes lecture notes and an optional number of questions, then returns generated flashcards, summaries, and practice questions.
 * - GenerateStudyMaterialsInput - The input type for the generateStudyMaterials function.
 * - GenerateStudyMaterialsOutput - The return type for the generateStudyMaterials function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateStudyMaterialsInputSchema = z.object({
  lectureNotes: z
    .string()
    .describe('The lecture notes to generate study materials from.'),
  numberOfQuestions: z
    .number()
    .optional()
    .describe('The desired number of practice questions. Defaults to 10 if not specified.'),
});
export type GenerateStudyMaterialsInput = z.infer<
  typeof GenerateStudyMaterialsInputSchema
>;

const QuizQuestionSchema = z.object({
  question: z.string().describe("The question text."),
  options: z.array(z.string()).min(3).max(5).describe("An array of 3-5 multiple choice options."),
  correctAnswer: z.string().describe("The correct answer string, which must be one of the provided options."),
  explanation: z.string().optional().describe("A brief explanation for the correct answer."),
});

const GenerateStudyMaterialsOutputSchema = z.object({
  flashcards: z.array(z.string()).describe('Generated flashcards, typically in a "Question - Answer" format.'),
  summary: z.string().describe('A concise summary of the lecture notes.'),
  practiceQuestions: z.array(QuizQuestionSchema).describe('Generated practice quiz questions, each with a question, multiple choice options, the correct answer, and an optional explanation.'),
});
export type GenerateStudyMaterialsOutput = z.infer<
  typeof GenerateStudyMaterialsOutputSchema
>;

export async function generateStudyMaterials(
  input: GenerateStudyMaterialsInput
): Promise<GenerateStudyMaterialsOutput> {
  return generateStudyMaterialsFlow(input);
}

const generateStudyMaterialsPrompt = ai.definePrompt({
  name: 'generateStudyMaterialsPrompt',
  input: {schema: GenerateStudyMaterialsInputSchema},
  output: {schema: GenerateStudyMaterialsOutputSchema},
  prompt: `You are an expert study material generator.

  Based on the lecture notes provided, generate:
  1. Flashcards: Create a list of flashcards. Each flashcard should be a string, ideally in a "Question - Answer" or "Term :: Definition" format.
  2. Summary: Provide a concise summary of the key points from the lecture notes.
  3. Practice Questions:
    {{#if numberOfQuestions}}
    Generate exactly {{{numberOfQuestions}}} multiple-choice practice questions.
    {{else}}
    Generate 10 multiple-choice practice questions.
    {{/if}}
    For each question, provide the question text, a list of 3-5 options, the correct answer (which must be one of the options), and an optional brief explanation for why the answer is correct.

  Lecture Notes:
  {{{lectureNotes}}}
  `,
});

const generateStudyMaterialsFlow = ai.defineFlow(
  {
    name: 'generateStudyMaterialsFlow',
    inputSchema: GenerateStudyMaterialsInputSchema,
    outputSchema: GenerateStudyMaterialsOutputSchema,
  },
  async input => {
    const {output} = await generateStudyMaterialsPrompt(input);
    return output!;
  }
);

