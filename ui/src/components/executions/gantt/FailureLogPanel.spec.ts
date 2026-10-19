import {afterEach, describe, expect, it, vi} from "vitest"
import {flushPromises} from "@vue/test-utils"
import {i18nMount} from "../../../../tests/unit/i18nMount"
import {routeQueryToQueryFilters} from "../../../utils/queryFilters"

const loadLogs = vi.hoisted(() => vi.fn())

vi.mock("../../../stores/executions", () => ({
    useExecutionsStore: () => ({loadLogs}),
}))

import FailureLogPanel from "./FailureLogPanel.vue"

describe("FailureLogPanel", () => {
    afterEach(() => {
        localStorage.clear()
    })

    it("should load only the focused task run's logs, not the whole execution's", async () => {
        loadLogs.mockReset().mockResolvedValue([])

        i18nMount(FailureLogPanel, {
            props: {executionId: "exec-1", taskRunId: "tr-1", executionKind: "PLAYGROUND"},
            global: {stubs: {LogLine: true}},
        })
        await flushPromises()

        expect(loadLogs).toHaveBeenCalledOnce()
        const filters = routeQueryToQueryFilters(loadLogs.mock.calls[0][0].params)
        expect(filters).toContainEqual({field: "taskRunId", operation: "EQUALS", value: "tr-1"})
        expect(filters).toContainEqual({field: "kind", operation: "IN", value: "PLAYGROUND"})
    })
})
