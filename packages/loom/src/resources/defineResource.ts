import { defineActionResource, type ActionResource, type ActionResourceDefinition } from './actionResource'
import type { WebResourceSchemaBoundary } from '../contracts'
import type { RouteMap } from 'vue-router'

type InvalidRouteParameterKeys<TAction> = TAction extends { route: { name: infer TName; params: infer TParams } }
  ? TName extends keyof RouteMap
    ? Exclude<keyof (TParams extends (...args: any[]) => infer TResult ? TResult : TParams), keyof RouteMap[TName]['paramsRaw']>
    : never
  : never

type InvalidResourceRouteParameterKeys<TActions> = {
  [Key in keyof TActions]: InvalidRouteParameterKeys<TActions[Key]>
}[keyof TActions]

export function defineResource<
  const TSchema extends WebResourceSchemaBoundary,
  const TActions extends ActionResourceDefinition<TSchema>['actions'],
>(
  schema: TSchema,
  definition: { key: string; actions: TActions } & (
    InvalidResourceRouteParameterKeys<TActions> extends never
      ? unknown
      : { readonly __invalidResourceRouteParameters__: never }
  ),
): ActionResource<TSchema, TActions> {
  return defineActionResource(schema, definition)
}
