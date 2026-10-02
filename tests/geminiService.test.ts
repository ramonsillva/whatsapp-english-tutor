import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { processUserMessage } from '../src/geminiService.ts';

describe('Gemini Pedagogical Service Tests', () => {
  it('should correct "discuss about" pattern and keep conversation going', async () => {
    const inputMsg = "Can we discuss about the presentation first?";
    const response = await processUserMessage('test_user_unit', inputMsg);

    assert.ok(response, 'A resposta não pode ser vazia');
    assert.ok(response.length > 20, 'A resposta deve ser detalhada');
    // Verifica se a resposta contém alguma correção pedagógica de "about" ou "discuss"
    assert.ok(
      response.toLowerCase().includes('discuss') || response.toLowerCase().includes('about'),
      'Deve referenciar a palavra corrigida'
    );
  });

  it('should correct Brazilian interference with "since" and progress the chat', async () => {
    const inputMsg = "I'm working here since 2021";
    const response = await processUserMessage('test_user_unit', inputMsg);

    assert.ok(response, 'A resposta não pode ser vazia');
    assert.ok(response.length > 20, 'A resposta deve ser detalhada');
  });
});
