import * as subrecipeStore from "./ordersStoreSubrecipes"
import type {
  SaveSubrecipeInput,
  Subrecipe,
  SubrecipeIngredient,
} from "./ordersStoreSubrecipes"

export type { SaveSubrecipeInput, Subrecipe, SubrecipeIngredient }

export async function getSubrecipes(branchId?: string | null): Promise<Subrecipe[]> {
  return subrecipeStore.getSubrecipes(branchId)
}

export async function saveSubrecipe(
  input: SaveSubrecipeInput,
  branchId?: string | null,
): Promise<Subrecipe> {
  return subrecipeStore.saveSubrecipe(input, branchId)
}

export async function deleteSubrecipe(id: string, branchId?: string | null) {
  return subrecipeStore.deleteSubrecipe(id, branchId)
}
