import { Router } from "../lib/router";
import {
    ActionResolver,
    IAction,
    IActionContext,
    ActionNotFound,
    actionResolver,
    ActionResolverInput,
} from "../lib/action";
import { ViewEngine, PageResult } from "../lib/view-engine";
import tpl, {
    asTemplate,
    ITemplate,
    disposeMany,
    Binding,
    render,
    DomDriver,
    init,
} from "glow.js";
import { BrowserRouter } from "../lib/browser-router";
import { IDriver } from "glow.js";
import { flatTree, renderMany } from "glow.js/lib/tpl";

interface OutletProps {
    routes: ActionResolverInput<IAction<any>>;
    router: Router;
    stacked?: boolean;
}

export function RouterOutlet(props: OutletProps, children: any[]) {
    const { routes, router, stacked = true } = props;
    const resolveAction = actionResolver(routes);
    return {
        render(driver: IDriver) {
            const viewEngine = new ViewEngine(executeAction, resolveAction, {});
            return router.start(viewEngine).subscribe();

            function executeAction(action: any, context: IActionContext) {
                const actionResult =
                    action &&
                    (typeof action === "function"
                        ? action(context)
                        : action.execute(context));

                const templates = flatTree(children.slice(0), (item) =>
                    applyChild(item, actionResult)
                );

                if (stacked) {
                    const scope = driver.createScope(0);
                    const bindings = renderMany(scope, templates);
                    return {
                        dispose() {
                            disposeMany(bindings);
                            scope.dispose();
                        },
                    };
                } else {
                    return {
                        activate() {
                            const bindings = renderMany(driver, templates);
                            return {
                                unsubscribe() {
                                    disposeMany(bindings);
                                },
                            };
                        },
                    };
                }
            }
        },
    };
}

function applyChild(child, template) {
    if (typeof child === "function") {
        return child(template);
    } else {
        return child;
    }
}

export function stackPage(driver: IDriver, actionResult: any): PageResult {
    const bindings = render(driver, actionResult);
    return new StackPageResult(bindings);
}

class StackPageResult {
    constructor(public bindings: Binding[]) {}

    dispose() {
        disposeMany(this.bindings);
    }
}

function defaultRenderPage(driver: IDriver, actionResult: any) {
    return new DefaultPageResult(driver, actionResult);
}

class DefaultPageResult {
    constructor(public driver: IDriver, public actionResult: any) {}

    activate() {
        const { driver, actionResult } = this;
        const bindings = render(driver, actionResult);
        return {
            unsubscribe() {
                disposeMany(bindings);
            },
        };
    }

    dispose() {}
}