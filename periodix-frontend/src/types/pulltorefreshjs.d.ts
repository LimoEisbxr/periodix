declare module 'pulltorefreshjs' {
    interface PullToRefreshOptions {
        /** Minimum distance required to trigger the refresh. Defaults to 60 */
        distThreshold?: number;
        /** Maximum distance possible for the element. Defaults to 80 */
        distMax?: number;
        /** After the distThreshold is reached and released, the element will have this height. Defaults to 50 */
        distReload?: number;
        /** After which distance should we start pulling? Defaults to 0 */
        distIgnore?: number;
        /** Before which element the pull to refresh elements will be? Defaults to 'body' */
        mainElement?: string | Element;
        /** Which element should trigger the pull to refresh? Defaults to 'body' */
        triggerElement?: string | Element;
        /** Which class will the main element have? Defaults to '.ptr' */
        ptrElement?: string;
        /** Which class prefix for the elements? Defaults to 'ptr--' */
        classPrefix?: string;
        /** Which property will be used to calculate the element's proportions? Defaults to 'min-height' */
        cssProp?: string;
        /** The icon for both instructionsPullToRefresh and instructionsReleaseToRefresh. Defaults to '&#8675;' */
        iconArrow?: string;
        /** The icon when the refresh is in progress. Defaults to '&hellip;' */
        iconRefreshing?: string;
        /** The initial instructions string. Defaults to 'Pull down to refresh' */
        instructionsPullToRefresh?: string;
        /** The instructions string when the distThreshold has been reached. Defaults to 'Release to refresh' */
        instructionsReleaseToRefresh?: string;
        /** The refreshing text. Defaults to 'Refreshing' */
        instructionsRefreshing?: string;
        /** The delay, in milliseconds before the onRefresh is triggered. Defaults to 500 */
        refreshTimeout?: number;
        /** It returns the default HTML for the widget */
        getMarkup?: () => string;
        /** It returns the default CSS for the widget */
        getStyles?: () => string;
        /** The initialize function */
        onInit?: () => void;
        /** What will the pull to refresh trigger? You can return a promise. Defaults to window.location.reload() */
        onRefresh?: () => void | Promise<void>;
        /** The resistance function, accepts one parameter, must return a number, capping at 1 */
        resistanceFunction?: (t: number) => number;
        /** Which condition should be met for pullToRefresh to trigger? Defaults to !window.scrollY */
        shouldPullToRefresh?: () => boolean;
    }

    interface PullToRefreshInstance {
        destroy: () => void;
    }

    interface PullToRefresh {
        init(options?: PullToRefreshOptions): PullToRefreshInstance;
        destroyAll(): void;
        setPassiveMode(isPassive: boolean): void;
    }

    const PullToRefresh: PullToRefresh;
    export default PullToRefresh;
}
