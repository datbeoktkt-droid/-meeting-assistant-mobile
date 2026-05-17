import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { walkAst } from "../../../utils/walk-ast.js";

const DOCUMENT_CLASS_LIST_MUTATION_METHOD_NAMES = new Set(["add", "remove", "toggle"]);
const DOCUMENT_CLASS_LIST_TARGET_NAMES = new Set(["body", "documentElement"]);

export const hasDocumentClassListMutation = (node: EsTreeNode): boolean => {
  let didFindMutation = false;
  walkAst(node, (child: EsTreeNode) => {
    if (didFindMutation) return false;
    if (!isNodeOfType(child, "CallExpression")) return;
    const callee = child.callee;
    if (
      !isNodeOfType(callee, "MemberExpression") ||
      !isNodeOfType(callee.property, "Identifier") ||
      !DOCUMENT_CLASS_LIST_MUTATION_METHOD_NAMES.has(callee.property.name)
    ) {
      return;
    }
    const classListExpression = callee.object;
    if (
      !isNodeOfType(classListExpression, "MemberExpression") ||
      !isNodeOfType(classListExpression.property, "Identifier") ||
      classListExpression.property.name !== "classList"
    ) {
      return;
    }
    const documentElementExpression = classListExpression.object;
    if (
      !isNodeOfType(documentElementExpression, "MemberExpression") ||
      !isNodeOfType(documentElementExpression.object, "Identifier") ||
      documentElementExpression.object.name !== "document" ||
      !isNodeOfType(documentElementExpression.property, "Identifier") ||
      !DOCUMENT_CLASS_LIST_TARGET_NAMES.has(documentElementExpression.property.name)
    ) {
      return;
    }
    didFindMutation = true;
  });
  return didFindMutation;
};
