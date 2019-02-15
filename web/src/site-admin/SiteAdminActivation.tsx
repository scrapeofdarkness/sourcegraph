import H from 'history'
import CheckboxBlankCircleOutlineIcon from 'mdi-react/CheckboxBlankCircleOutlineIcon'
import CheckboxMarkedCircleOutlineIcon from 'mdi-react/CheckboxMarkedCircleOutlineIcon'
import InformationOutlineIcon from 'mdi-react/InformationOutlineIcon'
import RocketIcon from 'mdi-react/RocketIcon'
import CircularProgressbar from 'react-circular-progressbar'

import * as React from 'react'
import Confetti from 'react-dom-confetti'
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs'
import { map, pairwise, startWith, switchMap } from 'rxjs/operators'
import { Props as CommandListProps } from '../../../shared/src/commandPalette/CommandList'
import { PopoverButton } from '../../../shared/src/components/PopoverButton'
import { dataAndErrors, dataOrThrowErrors, gql } from '../../../shared/src/graphql/graphql'
import { queryGraphQL } from '../backend/graphql'

export interface SiteAdminChecklistInfo {
    connectedCodeHost: boolean
    enabledRepository: boolean
    enabledExtension: boolean
    enabledSignOn: boolean
    didSearch: boolean
    didCodeIntelligence: boolean
}

interface ActivateConfettiState {
    fetchedTriggers: SiteAdminChecklistInfo | null

    // NEXT: rework logic from here...
    activated: boolean
}

interface ActivateConfettiProps {
    triggers: Partial<SiteAdminChecklistInfo>
    // clickTarget: React.RefObject<HTMLElement>
    click: {
        // activate on click...
        retrigger: () => void
    }
}

export class ActivateConfetti extends React.PureComponent<ActivateConfettiProps, ActivateConfettiState> {
    private subscriptions = new Subscription()

    constructor(props: ActivateConfettiProps) {
        super(props)
        this.state = { fetchedTriggers: null }
    }

    public componentDidMount(): void {
        // layering: {} -> remote-fetched (subset of props) -> props
        // equivalent: {} -> props -> 'or' with remote-fetched
        // ---------------------------
        // // TEST CODE
        // this.setState({ activated: false })
        // setTimeout(() => {
        //     this.setState({ activated: true })
        // }, 2000)

        this.subscriptions.add(siteAdminChecklist.subscribe(fetchedTriggers => this.setState({ fetchedTriggers })))
    }

    private isActivated(): boolean | undefined {
        if (this.state.fetchedTriggers === null) {
            return undefined
        }
        const triggers: { [key: string]: boolean } = {}
        Object.assign(triggers, this.props)
        if (this.state.fetchedTriggers) {
            const fetchedTriggers: { [key: string]: boolean } = {}
            Object.assign(fetchedTriggers, this.state.fetchedTriggers)
            for (const k of Object.keys(triggers)) {
                triggers[k] = triggers[k] || fetchedTriggers[k]
            }
        }

        for (const v of Object.values(triggers)) {
            if (!v) {
                return false
            }
        }
        return true
    }

    private clicked = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        // if (!this.state.activated) {
        //     e.preventDefault()
        //     refreshUserActivation.next({ didSearch: true })
        //     this.setState({ activated: true })
        //     setTimeout(() => {
        //         if (this.button.current) {
        //             this.button.current.click()
        //         }
        //     }, 1000)
        // }
    }

    public render(): JSX.Element | null {
        const activated = this.isActivated()
        return (
            <div onClick={this.clicked}>
                {activated !== undefined && (
                    <Confetti
                        active={activated}
                        config={{
                            angle: 180,
                            spread: 45,
                            startVelocity: 45,
                            elementCount: 50,
                            dragFriction: 0.1,
                            duration: 3000,
                            delay: 0,
                            width: '10px',
                            height: '10px',
                            colors: ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'],
                        }}
                    />
                )}
                {this.props.children}
            </div>
        )
    }
}

/**
 * percentageDone returns the percent of activation checklist items completed.
 */
export const percentageDone = (info?: SiteAdminChecklistInfo): number => {
    if (!info) {
        return 0
    }
    const vals = Object.values(info)
    return (100 * vals.filter(e => e).length) / vals.length
}

/**
 * Clients use this to trigger an update of the activation state. If the next value is null,
 * the activation value will be synced from the server. If the next value is non-null, it will
 * be forwarded as-is.
 */
export const refreshUserActivation = new BehaviorSubject<Partial<SiteAdminChecklistInfo> | null>(null)

/** The latest value either fetched or triggered */
const partialSiteAdminChecklist: Observable<Partial<SiteAdminChecklistInfo>> = refreshUserActivation.pipe(
    switchMap(v => {
        if (v) {
            return of<Partial<SiteAdminChecklistInfo>>(v)
        } else {
            return queryGraphQL(gql`
                query {
                    externalServices {
                        totalCount
                    }
                    repositories(enabled: true) {
                        totalCount
                    }
                    viewerSettings {
                        final
                    }
                    currentUser {
                        usageStatistics {
                            searchQueries
                            codeIntelligenceActions
                        }
                    }
                }
            `).pipe(
                map(dataOrThrowErrors),
                map(data => {
                    const settings = JSON.parse(data.viewerSettings.final)
                    const authProviders = window.context.authProviders
                    return {
                        connectedCodeHost: data.externalServices.totalCount > 0,
                        enabledRepository: data.repositories.totalCount !== null && data.repositories.totalCount > 0,
                        enabledExtension:
                            settings.extensions &&
                            Object.values(settings.extensions).filter(enabled => enabled).length > 0,
                        enabledSignOn: !!(authProviders && authProviders.filter(p => !p.isBuiltin).length > 0),
                        didSearch: !!data.currentUser && data.currentUser.usageStatistics.searchQueries > 0,
                        didCodeIntelligence:
                            !!data.currentUser && data.currentUser.usageStatistics.codeIntelligenceActions > 0,
                    }
                })
            )
        }
    })
)

/**
 * The up-to-date site admin checklist
 */
export const siteAdminChecklist: Observable<SiteAdminChecklistInfo> = partialSiteAdminChecklist.pipe(
    startWith({}),
    pairwise<Partial<SiteAdminChecklistInfo>>(),
    map(pair => {
        // Because we are receiving partials, merge in with previous vals
        const cl = {
            connectedCodeHost: false,
            enabledRepository: false,
            enabledExtension: false,
            enabledSignOn: false,
            didSearch: false,
            didCodeIntelligence: false,
        }
        Object.assign(cl, pair[0])
        Object.assign(cl, pair[1])
        return cl
    })
)

export const fetchReferencesLink: () => Observable<string | null> = () =>
    queryGraphQL(gql`
        query {
            repositories(enabled: true, cloned: true, first: 100, indexed: true) {
                nodes {
                    url
                    gitRefs {
                        totalCount
                    }
                }
            }
        }
    `).pipe(
        map(dataAndErrors),
        map(dataAndErrors => {
            if (!dataAndErrors.data) {
                return null
            }
            const data = dataAndErrors.data
            if (!data.repositories.nodes) {
                return null
            }
            const rURLs = data.repositories.nodes
                .filter(r => r.gitRefs && r.gitRefs.totalCount > 0)
                .sort(r => (r.gitRefs ? -r.gitRefs.totalCount : 0))
                .map(r => r.url)
            if (rURLs.length === 0) {
                return null
            }
            return rURLs[0]
        })
    )

interface SiteAdminActivationPopoverButtonProps extends CommandListProps {
    history: H.History
}
interface SiteAdminActivationPopoverButtonState {
    checklistInfo?: SiteAdminChecklistInfo
}

/**
 * SiteAdminActivationPopoverButton is the nav bar button that opens the site admin
 * activation checklist as a dropdown.
 */
export class SiteAdminActivationPopoverButton extends React.PureComponent<
    SiteAdminActivationPopoverButtonProps,
    SiteAdminActivationPopoverButtonState
> {
    private subscriptions = new Subscription()

    constructor(props: SiteAdminActivationPopoverButtonProps) {
        super(props)
        this.state = {
            checklistInfo: {
                connectedCodeHost: false,
                enabledRepository: false,
                enabledExtension: false,
                enabledSignOn: false,
                didSearch: false,
                didCodeIntelligence: false,
            },
        }
    }

    public componentDidMount(): void {
        this.subscriptions.add(
            siteAdminChecklist.subscribe(checklistInfo => {
                this.setState({ checklistInfo })
            })
        )
        refreshUserActivation.next(null)
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
        // MARK
        const percentage = this.state.checklistInfo ? percentageDone(this.state.checklistInfo) : 0
        return (
            <div>
                <PopoverButton
                    className="onboarding-button"
                    {...this.state}
                    popoverClassName="rounded"
                    placement="auto-end"
                    hideOnChange={true}
                    hideCaret={true}
                    popoverElement={<SiteAdminActivationPopoverDropdown history={this.props.history} {...this.state} />}
                >
                    <span className="link-like">Setup</span>
                    <div className="progress-bar-container">
                        <CircularProgressbar strokeWidth={12} percentage={percentage} />
                    </div>
                </PopoverButton>
            </div>
        )
    }
}

/**
 * SiteAdminActivationPopoverDropdown presents the site admin activation checklist
 * in a navbar dropdown.
 */
export class SiteAdminActivationPopoverDropdown extends React.PureComponent<SiteAdminChecklistProps, {}> {
    public render(): JSX.Element {
        return (
            <div className="onboarding-container command-list list-group list-group-flush rounded">
                <div className="list-group-item">
                    <div className="header">
                        <h2>
                            <RocketIcon className="icon-inline" /> Hi there!
                        </h2>
                        <p>
                            This is the Sourcegraph Quick Start Guide. Complete the steps below to finish setting up
                            your Sourcegraph instance.
                        </p>
                    </div>
                </div>
                <div className="list-group-item">
                    <SiteAdminChecklist {...this.props} />
                </div>
            </div>
        )
    }
}

interface SiteAdminChecklistProps {
    history: H.History
    checklistInfo?: SiteAdminChecklistInfo
}

/**
 * SiteAdminChecklist renders the site admin activation checklist.
 */
export class SiteAdminChecklist extends React.PureComponent<SiteAdminChecklistProps, {}> {
    private addCodeHosts = () => {
        this.props.history.push('/site-admin/external-services')
    }
    private enableRepos = () => {
        this.props.history.push('/site-admin/repositories')
    }
    private searchCode = () => {
        this.props.history.push('/search')
    }
    private findReferences = () => {
        fetchReferencesLink().subscribe(r => r && this.props.history.push(r))
    }
    private enableSignOn = () => {
        window.open('https://docs.sourcegraph.com/admin/auth', '_blank')
    }

    public render(): JSX.Element {
        return (
            <div className="site-admin-checklist-container">
                {this.props.checklistInfo ? (
                    <ul className="site-admin-checklist">
                        <li>
                            <ChecklistItem
                                title="Connect your code host"
                                done={this.props.checklistInfo.connectedCodeHost}
                                action={this.addCodeHosts}
                                detail="Configure Sourcegraph to talk to your code host and fetch a list of your repositories."
                            />
                        </li>
                        <li>
                            <ChecklistItem
                                title="Enable repositories"
                                done={this.props.checklistInfo.enabledRepository}
                                action={this.enableRepos}
                                detail="Select which repositories Sourcegraph should pull and index from your code host(s)."
                            />
                        </li>
                        <li>
                            <ChecklistItem
                                title="Search your code"
                                done={this.props.checklistInfo.didSearch}
                                action={this.searchCode}
                                detail="Issue a search query over your code."
                            />
                        </li>
                        <li>
                            <ChecklistItem
                                title="Find references"
                                done={this.props.checklistInfo.enabledRepository}
                                action={this.findReferences}
                                detail="To find references of a token, navigate to a code file in one of your repositories, hover over a token to activate the tooltip, and then click &ldquo;Find references&rdquo;."
                            />
                        </li>
                        <li>
                            <ChecklistItem
                                title="Configure sign-up"
                                done={this.props.checklistInfo.enabledSignOn}
                                action={this.enableSignOn}
                                detail="Configure a single-sign on (SSO) provider or enable open sign-up so you can share Sourcegraph with others on your team."
                            />
                        </li>
                    </ul>
                ) : (
                    <div>Loading...</div>
                )}
            </div>
        )
    }
}

interface ChecklistItemProps {
    title: string
    action: () => void
    done?: boolean
    detail?: string
}

interface ChecklistItemState {
    showDetail?: boolean
}

/**
 * ChecklistItem is a single item in the site admin activation checklist.
 */
class ChecklistItem extends React.PureComponent<ChecklistItemProps, ChecklistItemState> {
    public state: ChecklistItemState = {}

    private toggleDetail = (e: React.MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation()
        this.setState(state => ({ showDetail: !state.showDetail }))
    }

    public render(): JSX.Element {
        return (
            <div className="item-container">
                <p className="item-title" onClick={this.props.action}>
                    {this.props.done ? (
                        <CheckboxMarkedCircleOutlineIcon className="icon-inline done" />
                    ) : (
                        <CheckboxBlankCircleOutlineIcon className="icon-inline todo" />
                    )}
                    &nbsp;&nbsp;
                    {this.props.title}
                    &nbsp;
                    <span className="info-button" onClick={this.toggleDetail}>
                        <InformationOutlineIcon className="icon-inline" />
                    </span>
                </p>
                <p className={`item-detail ${this.state.showDetail ? 'show' : 'hide'}`}>{this.props.detail}</p>
            </div>
        )
    }
}
