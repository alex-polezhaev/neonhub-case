export interface Idea {
  row_number: number
  used: string
  product: string
  input1: string
  input2?: string
  input3?: string
  input4?: string
  input5?: string
  input6?: string
  input7?: string
  input8?: string
  input9?: string
  input10?: string
  [key: `var-${string}`]: string
}

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
  group?: string
  input1?: string
  input2?: string
  input3?: string
  input4?: string
  input5?: string
  input6?: string
  input7?: string
  input8?: string
  input9?: string
  input10?: string
  thinkingLevel?: string
  imageSize?: string
  aspectRatio?: string
  model?: string
}

export interface Task {
  ideaRowNumber: number
  promptId: string
  duplicateIndex: number
  idea: Idea
  prompt: PromptTemplate
  resolvedPrompt: string
}
