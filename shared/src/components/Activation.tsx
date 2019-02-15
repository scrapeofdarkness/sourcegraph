import { setupMaster } from 'cluster'
import { BehaviorSubject, Observable } from 'rxjs'
import { first, switchMap } from 'rxjs/operators'
import { updateArrayBindingPattern } from 'typescript'

export class ActivationStatus {
    /**
     * Props
     */
    private steps: ActivationStep[]
    private fetchCompleted: () => Observable<{ [key: string]: boolean }>

    /**
     * State
     */
    private completed: BehaviorSubject<{ [key: string]: boolean } | null>

    constructor(steps: ActivationStep[], fetchCompleted: () => Observable<{ [key: string]: boolean }>) {
        this.steps = steps
        this.fetchCompleted = fetchCompleted
        this.completed = new BehaviorSubject<{ [key: string]: boolean } | null>(null)
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

export interface ActivationStep {
    id: string
    title: string
    detail: string
    action: () => void
}

// Views:
// * Checklist
// * ActivationClickTarget
