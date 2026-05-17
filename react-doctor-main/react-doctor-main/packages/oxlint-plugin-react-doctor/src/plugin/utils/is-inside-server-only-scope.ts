import { TANSTACK_SERVER_FN_NAMES } from "../constants/tanstack.js";
import type { EsTreeNode } from "./es-tree-node.js";
import { getCalleeName } from "./get-callee-name.js";
import { hasUseServerDirective } from "./has-use-server-directive.js";
import { isNodeOfType } from "./is-node-of-type.js";

const isFunctionNode = (node: EsTreeNode): boolean =>
  isNodeOfType(node, "ArrowFunctionExpression") ||
  isNodeOfType(node, "FunctionDeclaration") ||
  isNodeOfType(node, "FunctionExpression");

const isTanStackServerFnHandlerCall = (node: EsTreeNode): boolean => {
  if (!isNodeOfType(node, "CallExpression")) return false;
  if (!isNodeOfType(node.callee, "MemberExpression")) return false;
  if (!isNodeOfType(node.callee.property, "Identifier")) return false;
  if (node.callee.property.name !== "handler") return false;

  let currentNode: EsTreeNode = node.callee.object;
  while (isNodeOfType(currentNode, "CallExpression")) {
    const calleeName = getCalleeName(currentNode);
    if (calleeName && TANSTACK_SERVER_FN_NAMES.has(calleeName)) return true;
    if (!isNodeOfType(currentNode.callee, "MemberExpression")) return false;
    currentNode = currentNode.callee.object;
  }

  return false;
};

const isTanStackServerFnHandler = (node: EsTreeNode): boolean => {
  const parent = node.parent;
  if (!parent || !isNodeOfType(parent, "CallExpression")) return false;
  if (!parent.arguments?.some((argument) => argument === node)) return false;
  return isTanStackServerFnHandlerCall(parent);
};

export const isInsideServerOnlyScope = (node: EsTreeNode): boolean => {
  let currentNode = node.parent ?? null;
  while (currentNode) {
    if (isFunctionNode(currentNode)) {
      if (hasUseServerDirective(currentNode) || isTanStackServerFnHandler(currentNode)) {
        return true;
      }
    }
    currentNode = currentNode.parent ?? null;
  }

  return false;
};
