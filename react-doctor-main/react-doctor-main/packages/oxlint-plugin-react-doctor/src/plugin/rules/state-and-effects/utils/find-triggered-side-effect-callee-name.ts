import {
  EVENT_TRIGGERED_NAVIGATION_METHOD_NAMES,
  EVENT_TRIGGERED_SIDE_EFFECT_CALLEES,
  EVENT_TRIGGERED_SIDE_EFFECT_MEMBER_METHODS,
  NAVIGATION_RECEIVER_NAMES,
} from "../../../constants/react.js";
import type { EsTreeNode } from "../../../utils/es-tree-node.js";
import { getRootIdentifierName } from "../../../utils/get-root-identifier-name.js";
import { isNodeOfType } from "../../../utils/is-node-of-type.js";
import { walkAst } from "../../../utils/walk-ast.js";

export const findTriggeredSideEffectCalleeName = (consequentNode: EsTreeNode): string | null => {
  let foundCalleeName: string | null = null;
  walkAst(consequentNode, (child: EsTreeNode) => {
    if (foundCalleeName) return false;
    if (!isNodeOfType(child, "CallExpression")) return;
    const callee = child.callee;
    if (
      isNodeOfType(callee, "Identifier") &&
      EVENT_TRIGGERED_SIDE_EFFECT_CALLEES.has(callee.name)
    ) {
      foundCalleeName = callee.name;
      return;
    }
    if (isNodeOfType(callee, "MemberExpression") && isNodeOfType(callee.property, "Identifier")) {
      const propertyName = callee.property.name;
      const isUnambiguousMethod = EVENT_TRIGGERED_SIDE_EFFECT_MEMBER_METHODS.has(propertyName);
      const isNavigationMethod = EVENT_TRIGGERED_NAVIGATION_METHOD_NAMES.has(propertyName);
      if (!isUnambiguousMethod && !isNavigationMethod) return;
      const rootName = getRootIdentifierName(callee);
      if (isNavigationMethod && (rootName === null || !NAVIGATION_RECEIVER_NAMES.has(rootName))) {
        return;
      }
      foundCalleeName = rootName ? `${rootName}.${propertyName}` : propertyName;
    }
  });
  return foundCalleeName;
};
