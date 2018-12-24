
import { GfxBindingsDescriptor, GfxBindings, GfxDevice, GfxBufferBinding, GfxSamplerBinding, GfxRenderPipelineDescriptor, GfxRenderPipeline, GfxMegaStateDescriptor, GfxBindingLayoutDescriptor, GfxProgram, GfxInputLayoutDescriptor, GfxVertexAttributeDescriptor, GfxInputLayout } from "../platform/GfxPlatform";
import { HashMap, EqualFunc, nullHashFunc } from "../../HashMap";

function arrayEqual<T>(a: T[], b: T[], e: EqualFunc<T>): boolean {
    if (a.length !== b.length) return false;
    for (let i = a.length - 1; i >= 0; i--)
        if (!e(a[i], b[i]))
            return false;
    return true;
}

function gfxBufferBindingEquals(a: GfxBufferBinding, b: GfxBufferBinding): boolean {
    return a.buffer === b.buffer && a.wordCount === b.wordCount && a.wordOffset === b.wordOffset;
}

function gfxSamplerBindingEquals(a: GfxSamplerBinding | null, b: GfxSamplerBinding | null): boolean {
    if (a === null) return b === null;
    if (b === null) return false;
    return a.sampler === b.sampler && a.texture === b.texture;
}

function gfxBindingsDescriptorEquals(a: GfxBindingsDescriptor, b: GfxBindingsDescriptor): boolean {
    if (a.bindingLayout !== b.bindingLayout) return false;
    if (!arrayEqual(a.uniformBufferBindings, b.uniformBufferBindings, gfxBufferBindingEquals)) return false;
    if (!arrayEqual(a.samplerBindings, b.samplerBindings, gfxSamplerBindingEquals)) return false;
    return true;
}

function gfxMegaStateDescriptorEquals(a: GfxMegaStateDescriptor, b: GfxMegaStateDescriptor): boolean {
    return (
        a.blendDstFactor === b.blendDstFactor &&
        a.blendSrcFactor === b.blendSrcFactor &&
        a.blendMode === b.blendMode &&
        a.cullMode === b.cullMode &&
        a.depthCompare === b.depthCompare &&
        a.depthWrite === b.depthWrite &&
        a.frontFace === b.frontFace &&
        a.polygonOffset === b.polygonOffset
    );
}

function gfxBindingLayoutEquals(a: GfxBindingLayoutDescriptor, b: GfxBindingLayoutDescriptor): boolean {
    return a.numSamplers === b.numSamplers && a.numUniformBuffers === b.numUniformBuffers;
}

// XXX(jstpierre): giant hack!!!
// We need to cache programs at a higher level so we won't have to query program keys here.
let _device: GfxDevice;
function gfxProgramEquals(a: GfxProgram, b: GfxProgram): boolean {
    return _device.queryProgram(a).uniqueKey === _device.queryProgram(b).uniqueKey;
}

function gfxRenderPipelineDescriptorEquals(a: GfxRenderPipelineDescriptor, b: GfxRenderPipelineDescriptor): boolean {
    if (a.topology !== b.topology) return false;
    if (a.inputLayout !== b.inputLayout) return false;
    if (!gfxMegaStateDescriptorEquals(a.megaStateDescriptor, b.megaStateDescriptor)) return false;
    if (!gfxProgramEquals(a.program, b.program)) return false;
    if (!arrayEqual(a.bindingLayouts, b.bindingLayouts, gfxBindingLayoutEquals)) return false;
    return true;
}

function gfxVertexAttributeDesciptorEquals(a: GfxVertexAttributeDescriptor, b: GfxVertexAttributeDescriptor): boolean {
    return (
        a.bufferIndex === b.bufferIndex &&
        a.bufferByteOffset === b.bufferByteOffset &&
        a.location === b.location &&
        a.format === b.format &&
        a.frequency === b.frequency &&
        a.usesIntInShader === b.usesIntInShader
    );
}

function gfxInputLayoutDescriptorEquals(a: GfxInputLayoutDescriptor, b: GfxInputLayoutDescriptor): boolean {
    if (a.indexBufferFormat !== b.indexBufferFormat) return false;
    if (!arrayEqual(a.vertexAttributeDescriptors, b.vertexAttributeDescriptors, gfxVertexAttributeDesciptorEquals)) return false;
    return true;
}

export class GfxRenderCache {
    private gfxBindingsCache = new HashMap<GfxBindingsDescriptor, GfxBindings>(gfxBindingsDescriptorEquals, nullHashFunc);
    private gfxRenderPipelinesCache = new HashMap<GfxRenderPipelineDescriptor, GfxRenderPipeline>(gfxRenderPipelineDescriptorEquals, nullHashFunc);
    private gfxInputLayoutsCache = new HashMap<GfxInputLayoutDescriptor, GfxInputLayout>(gfxInputLayoutDescriptorEquals, nullHashFunc);

    public createBindings(device: GfxDevice, descriptor: GfxBindingsDescriptor): GfxBindings {
        let bindings = this.gfxBindingsCache.get(descriptor);
        if (bindings === null) {
            bindings = device.createBindings(descriptor);
            this.gfxBindingsCache.insert(descriptor, bindings);
        }
        return bindings;
    }

    public createRenderPipeline(device: GfxDevice, descriptor: GfxRenderPipelineDescriptor): GfxRenderPipeline {
        _device = device;

        let renderPipeline = this.gfxRenderPipelinesCache.get(descriptor);
        if (renderPipeline === null) {
            renderPipeline = device.createRenderPipeline(descriptor);
            this.gfxRenderPipelinesCache.insert(descriptor, renderPipeline);
        }
        return renderPipeline;
    }

    public createInputLayout(device: GfxDevice, descriptor: GfxInputLayoutDescriptor): GfxInputLayout {
        let inputLayout = this.gfxInputLayoutsCache.get(descriptor);
        if (inputLayout === null) {
            inputLayout = device.createInputLayout(descriptor);
            this.gfxInputLayoutsCache.insert(descriptor, inputLayout);
        }
        return inputLayout;
    }

    public numBindings(): number {
        return this.gfxBindingsCache.size();
    }

    public destroy(device: GfxDevice): void {
        for (const [descriptor, bindings] of this.gfxBindingsCache.entries())
            device.destroyBindings(bindings);
        for (const [descriptor, renderPipeline] of this.gfxRenderPipelinesCache.entries())
            device.destroyRenderPipeline(renderPipeline);
        this.gfxBindingsCache.clear();
        this.gfxRenderPipelinesCache.clear();
    }
}
