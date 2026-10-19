import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import {nextTick} from "vue"
import type {DOMWrapper, VueWrapper} from "@vue/test-utils"
import {i18nMount} from "../../../../tests/unit/i18nMount"
import FailureMiniTimeline from "./FailureMiniTimeline.vue"

const POINTER_ID = 7

function taskRun(id: string, taskId: string, start: string, end: string) {
    return {
        id,
        taskId,
        state: {
            current: "FAILED",
            histories: [
                {state: "RUNNING", date: start},
                {state: "FAILED", date: end},
            ],
        },
    }
}

const nodes = [
    {taskRun: taskRun("tr-a", "first", "2026-01-01T00:00:00Z", "2026-01-01T00:00:10Z"), relation: "focused"},
    {taskRun: taskRun("tr-b", "second", "2026-01-01T00:00:05Z", "2026-01-01T00:00:20Z"), relation: "sibling"},
]

let mounted: VueWrapper | undefined

async function firePointer(target: DOMWrapper<Element>, type: string, init: PointerEventInit = {}) {
    target.element.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId: POINTER_ID, ...init}))
    await nextTick()
}

function mountTimeline() {
    const wrapper = i18nMount(FailureMiniTimeline, {props: {nodes: nodes as never, focusedId: "tr-a"}})
    mounted = wrapper
    const track = wrapper.find(".mini-timeline__track")
    const element = track.element as HTMLElement
    const captured = new Set<number>()
    const setPointerCapture = vi.fn((id: number) => captured.add(id))
    element.setPointerCapture = setPointerCapture
    element.releasePointerCapture = vi.fn((id: number) => captured.delete(id))
    element.hasPointerCapture = (id: number) => captured.has(id)
    return {wrapper, track, setPointerCapture}
}

beforeEach(() => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        left: 0, top: 0, right: 400, bottom: 40, width: 400, height: 40, x: 0, y: 0, toJSON: () => ({}),
    })
})

afterEach(() => {
    mounted?.unmount()
    mounted = undefined
    vi.restoreAllMocks()
})

describe("FailureMiniTimeline", () => {
    it("should focus the clicked bar without capturing the pointer, so the click still reaches the bar", async () => {
        const {wrapper, track, setPointerCapture} = mountTimeline()
        const bar = wrapper.findAll(".mini-timeline__bar")[1]

        await firePointer(bar, "pointerdown", {button: 0, clientX: 300})
        await firePointer(track, "pointerup", {clientX: 300})
        await bar.trigger("click")

        expect(setPointerCapture).not.toHaveBeenCalled()
        expect(wrapper.emitted("focus-task")).toEqual([["tr-b"]])
        expect(wrapper.emitted("select-range")).toBeUndefined()
    })

    it("should capture the pointer once the gesture becomes a drag, so a release outside the track still ends it", async () => {
        const {wrapper, track, setPointerCapture} = mountTimeline()

        await firePointer(track, "pointerdown", {button: 0, clientX: 100})
        await firePointer(track, "pointermove", {clientX: 102})
        expect(setPointerCapture).not.toHaveBeenCalled()

        await firePointer(track, "pointermove", {clientX: 300})
        expect(setPointerCapture).toHaveBeenCalledOnce()
        expect(setPointerCapture).toHaveBeenCalledWith(POINTER_ID)

        await firePointer(track, "pointerup", {clientX: 500})

        expect(wrapper.emitted("select-range")).toHaveLength(1)
        expect(wrapper.find(".mini-timeline__band").exists()).toBe(true)
    })

    it("should not start a drag nor capture the pointer for a non-primary button", async () => {
        const {wrapper, track, setPointerCapture} = mountTimeline()

        await firePointer(track, "pointerdown", {button: 2, clientX: 100})
        await firePointer(track, "pointermove", {clientX: 300})

        expect(setPointerCapture).not.toHaveBeenCalled()
        expect(wrapper.find(".mini-timeline__band").exists()).toBe(false)
    })

    it.each(["pointercancel", "lostpointercapture"])("should drop the drag preview on %s without selecting", async (eventName) => {
        const {wrapper, track} = mountTimeline()

        await firePointer(track, "pointerdown", {button: 0, clientX: 100})
        await firePointer(track, "pointermove", {clientX: 300})
        expect(wrapper.find(".mini-timeline__band").exists()).toBe(true)

        await firePointer(track, eventName)

        expect(wrapper.find(".mini-timeline__band").exists()).toBe(false)
        expect(wrapper.emitted("select-range")).toBeUndefined()
    })

    it("should draw the drag band when the timeline was mounted hidden and only measured once shown", async () => {
        const rectSpy = vi.mocked(Element.prototype.getBoundingClientRect)
        const visibleRect = rectSpy.getMockImplementation()
        rectSpy.mockReturnValue({left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({})})
        const {wrapper, track} = mountTimeline()
        await nextTick()
        expect(wrapper.find(".mini-timeline__band").exists()).toBe(false)
        rectSpy.mockImplementation(visibleRect!)

        await firePointer(track, "pointerdown", {button: 0, clientX: 100})
        await firePointer(track, "pointermove", {clientX: 300})

        expect(wrapper.find(".mini-timeline__band").attributes("style")).toContain("width: 50%")

        await firePointer(track, "pointerup", {clientX: 300})

        expect(wrapper.find(".mini-timeline__band").exists()).toBe(true)
    })

    it("should drop a pending press when the pointer leaves the track before it became a drag", async () => {
        const {wrapper, track} = mountTimeline()

        await firePointer(track, "pointerdown", {button: 0, clientX: 398})
        await firePointer(track, "pointerleave", {clientX: 401})

        expect(wrapper.find(".mini-timeline__band").exists()).toBe(false)
    })
})
