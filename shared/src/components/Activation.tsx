import H from 'history'
import RocketIcon from 'mdi-react/RocketIcon'
import * as React from 'react'
import CircularProgressbar from 'react-circular-progressbar'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { first, switchMap } from 'rxjs/operators'
import { updateArrayBindingPattern } from 'typescript'
import { Props as CommandListProps } from '../commandPalette/CommandList'
import { PopoverButton } from './PopoverButton'

export interface ActivationStep {
    id: string
    title: string
    detail: string
    action: () => void
}

export class ActivationStatus {
    /**
     * Props
     */
    private steps_: ActivationStep[]
    private fetchCompleted: () => Observable<{ [key: string]: boolean }>

    /**
     * State
     */
    private completed_: BehaviorSubject<{ [key: string]: boolean } | null>

    constructor(steps: ActivationStep[], fetchCompleted: () => Observable<{ [key: string]: boolean }>) {
        this.steps_ = steps
        this.fetchCompleted = fetchCompleted
        this.completed_ = new BehaviorSubject<{ [key: string]: boolean } | null>(null)
    }

    public get steps(): ActivationStep[] {
        return this.steps_
    }

    public get completed(): BehaviorSubject<{ [key: string]: boolean } | null> {
        return this.completed_
    }

    public ensureInit(): void {
        if (!this.completed.value) {
            this.update(null)
        }
    }

    public update(u: { [key: string]: boolean } | null): void {
        if (u) {
            this.fetchCompleted()
                .pipe(first()) // subscription will get auto-cleaned up
                .subscribe(res => this.completed.next(res))
        } else {
            if (!this.completed.value) {
                return
            }
            const newVal = {}
            Object.assign(newVal, this.completed.value)
            Object.assign(newVal, u)
            this.completed.next(newVal)
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////

// TODO(beyang): rename

interface SiteAdminActivationPopoverButtonProps extends CommandListProps {
    history: H.History
    activation: ActivationStatus
}
interface SiteAdminActivationPopoverButtonState {
    completed?: { [key: string]: boolean }
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
        this.state = {}
    }

    public componentDidMount(): void {
        this.subscriptions.add(
            this.props.activation.completed.subscribe(completed => {
                if (completed) {
                    this.setState({ completed })
                }
            })
        )
        this.props.activation.update(null)
    }

    public componentWillUnmount(): void {
        this.subscriptions.unsubscribe()
    }

    public render(): JSX.Element | null {
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
                    {this.state.completed && (
                        <div className="progress-bar-container">
                            <CircularProgressbar strokeWidth={12} percentage={percentageDone(this.state.completed)} />
                        </div>
                    )}
                </PopoverButton>
            </div>
        )
    }
}

interface SiteAdminChecklistProps {
    history: H.History
    completed?: { [key: string]: boolean }
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
                <div className="list-group-item">{/*<SiteAdminChecklist {...this.props} />*/}</div>
            </div>
        )
    }
}

/**
 * percentageDone returns the percent of activation checklist items completed.
 */
const percentageDone = (info: { [key: string]: boolean }): number => {
    const vals = Object.values(info)
    return (100 * vals.filter(e => e).length) / vals.length
}
