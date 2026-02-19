import type { DishSuggestion } from "@dotted/shared";

/**
 * Creates a mock Anthropic response with a tool_use block containing dish suggestions.
 */
export function createMockAnthropicResponse(dishes: DishSuggestion[]) {
  return {
    id: "msg_test_123",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [
      {
        type: "tool_use",
        id: "toolu_test_123",
        name: "suggest_dishes",
        input: { dishes },
      },
    ],
    stop_reason: "tool_use",
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}

/**
 * Creates a mock Anthropic text response (for substitution suggestions).
 */
export function createMockSubstitutionResponse(text: string) {
  return {
    id: "msg_test_456",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    content: [
      {
        type: "text",
        text,
      },
    ],
    stop_reason: "end_turn",
    usage: { input_tokens: 50, output_tokens: 100 },
  };
}

/**
 * Sample dish suggestions for testing
 */
export function createSampleDishSuggestions(count: number = 4): DishSuggestion[] {
  const templates = [
    {
      name: "Tomato Basil Pasta",
      description: "Fresh pasta with roasted tomatoes and basil",
      cuisine: "Italian",
      estimatedCost: 12,
      tags: ["vegetarian"],
      recipeSpec: { servings: 4, prepTime: 15, cookTime: 25, instructions: ["Boil pasta", "Make sauce", "Combine"], tags: ["quick"] },
      ingredients: [
        { name: "Tomatoes", quantity: 2, unit: "kg", category: "Produce", substitutes: ["Cherry Tomatoes"] },
        { name: "Olive Oil", quantity: 0.2, unit: "liters", category: "Pantry", substitutes: ["Avocado Oil"] },
      ],
    },
    {
      name: "Grilled Chicken Bowl",
      description: "Herb-marinated chicken with seasonal vegetables",
      cuisine: "American",
      estimatedCost: 15,
      tags: ["high-protein"],
      recipeSpec: { servings: 4, prepTime: 20, cookTime: 30, instructions: ["Marinate", "Grill", "Assemble"], tags: ["healthy"] },
      ingredients: [
        { name: "Chicken Breast", quantity: 3, unit: "kg", category: "Protein", substitutes: ["Tofu"] },
        { name: "Tomatoes", quantity: 1, unit: "kg", category: "Produce", substitutes: [] },
      ],
    },
    {
      name: "Mediterranean Salad",
      description: "Crisp salad with olive oil dressing",
      cuisine: "Mediterranean",
      estimatedCost: 10,
      tags: ["vegetarian", "gluten-free"],
      recipeSpec: { servings: 4, prepTime: 10, cookTime: 0, instructions: ["Chop", "Dress", "Toss"], tags: ["no-cook"] },
      ingredients: [
        { name: "Tomatoes", quantity: 1.5, unit: "kg", category: "Produce", substitutes: [] },
        { name: "Olive Oil", quantity: 0.1, unit: "liters", category: "Pantry", substitutes: [] },
      ],
    },
    {
      name: "Chicken Tikka Masala",
      description: "Creamy spiced chicken in tomato sauce",
      cuisine: "Indian",
      estimatedCost: 14,
      tags: ["spicy"],
      recipeSpec: { servings: 4, prepTime: 25, cookTime: 40, instructions: ["Marinate", "Cook chicken", "Make sauce", "Combine"], tags: ["comfort"] },
      ingredients: [
        { name: "Chicken Breast", quantity: 2.5, unit: "kg", category: "Protein", substitutes: ["Paneer"] },
        { name: "Tomatoes", quantity: 2, unit: "kg", category: "Produce", substitutes: ["Canned Tomatoes"] },
      ],
    },
  ];

  return templates.slice(0, count);
}
