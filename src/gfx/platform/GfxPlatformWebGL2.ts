
import { GfxBufferUsage, GfxBindingLayoutDescriptor, GfxBufferFrequencyHint, GfxTexFilterMode, GfxMipFilterMode, GfxPrimitiveTopology, GfxSwapChain, GfxDevice, GfxSamplerDescriptor, GfxWrapMode, GfxVertexBufferDescriptor, GfxRenderPipelineDescriptor, GfxBufferBinding, GfxSamplerBinding, GfxProgramReflection, GfxDeviceLimits, GfxVertexAttributeDescriptor, GfxRenderTargetDescriptor, GfxLoadDisposition, GfxRenderPass, GfxPass, GfxHostAccessPass, GfxMegaStateDescriptor, GfxCompareMode, GfxBlendMode, GfxCullMode, GfxBlendFactor, GfxFrontFaceMode, GfxInputStateReflection, GfxVertexAttributeFrequency, GfxRenderPassDescriptor, GfxTextureDescriptor, GfxTextureDimension, makeTextureDescriptor2D, GfxBindingsDescriptor, GfxDebugGroup, GfxInputLayoutDescriptor } from './GfxPlatform';
import { _T, GfxBuffer, GfxTexture, GfxColorAttachment, GfxDepthStencilAttachment, GfxRenderTarget, GfxSampler, GfxProgram, GfxInputLayout, GfxInputState, GfxRenderPipeline, GfxBindings, GfxResource } from "./GfxPlatformImpl";
import { GfxFormat, getFormatCompByteSize, FormatTypeFlags, FormatCompFlags, FormatFlags, getFormatTypeFlags, getFormatCompFlags } from "./GfxPlatformFormat";

import { DeviceProgram, ProgramCache, DeviceProgramReflection } from '../../Program';
import { FullscreenCopyProgram, RenderState } from '../../render';
import { assert } from '../../util';
import { fullscreenFlags, defaultFlags, RenderFlags } from '../helpers/RenderFlagsHelpers';

interface GfxBufferP_GL extends GfxBuffer {
    gl_buffer_pages: WebGLBuffer[];
    gl_target: GLenum;
    usage: GfxBufferUsage;
    byteSize: number;
    pageByteSize: number;
}

interface GfxTextureP_GL extends GfxTexture {
    gl_texture: WebGLTexture;
    gl_target: GLenum;
    pixelFormat: GfxFormat;
    width: number;
    height: number;
    depth: number;
}

interface GfxColorAttachmentP_GL extends GfxColorAttachment {
    gl_renderbuffer: WebGLRenderbuffer;
    width: number;
    height: number;
}

interface GfxDepthStencilAttachmentP_GL extends GfxDepthStencilAttachment {
    gl_renderbuffer: WebGLRenderbuffer;
    width: number;
    height: number;
}

interface GfxSamplerP_GL extends GfxSampler {
    gl_sampler: WebGLSampler;
}

interface GfxProgramP_GL extends GfxProgram {
    gl_program: WebGLProgram;
    deviceProgram: DeviceProgram;
}

interface GfxBindingsP_GL extends GfxBindings {
    uniformBufferBindings: GfxBufferBinding[];
    samplerBindings: (GfxSamplerBinding | null)[];
}

interface GfxRenderTargetP_GL extends GfxRenderTarget {
    gl_framebuffer: WebGLFramebuffer;
    colorAttachment: GfxColorAttachmentP_GL | null;
    depthAttachment: GfxDepthStencilAttachmentP_GL | null;
}

interface GfxInputLayoutP_GL extends GfxInputLayout {
    vertexAttributeDescriptors: GfxVertexAttributeDescriptor[];
    indexBufferFormat: GfxFormat | null;
}

interface GfxInputStateP_GL extends GfxInputState {
    vao: WebGLVertexArrayObject;
    indexBufferByteOffset: number;
    indexBufferType: GLenum;
    indexBufferCompByteSize: number;
    inputLayout: GfxInputLayoutP_GL;
}

interface GfxBindingLayoutTableP_GL {
    firstUniformBuffer: number;
    numUniformBuffers: number;
    firstSampler: number;
    numSamplers: number;
}

interface GfxBindingLayoutsP_GL {
    numSamplers: number;
    numUniformBuffers: number;
    bindingLayoutTables: GfxBindingLayoutTableP_GL[];
}

interface GfxRenderPipelineP_GL extends GfxRenderPipeline {
    bindingLayouts: GfxBindingLayoutsP_GL;
    program: GfxProgramP_GL;
    drawMode: GLenum;
    megaState: GfxMegaStateDescriptor;
    inputLayout: GfxInputLayoutP_GL | null;
}

export function translateVertexFormat(fmt: GfxFormat): { size: number, type: GLenum, normalized: boolean } {
    function translateType(flags: FormatTypeFlags): GLenum {
        switch (flags) {
        case FormatTypeFlags.U8:
            return WebGL2RenderingContext.UNSIGNED_BYTE;
        case FormatTypeFlags.U16:
            return WebGL2RenderingContext.UNSIGNED_SHORT;
        case FormatTypeFlags.U32:
            return WebGL2RenderingContext.UNSIGNED_INT;
        case FormatTypeFlags.S8:
            return WebGL2RenderingContext.BYTE;
        case FormatTypeFlags.S16:
            return WebGL2RenderingContext.SHORT;
        case FormatTypeFlags.S32:
            return WebGL2RenderingContext.INT;
        case FormatTypeFlags.F16:
            return WebGL2RenderingContext.HALF_FLOAT;
        case FormatTypeFlags.F32:
            return WebGL2RenderingContext.FLOAT;
        default:
            throw "whoops";
        }
    }

    function translateSize(flags: FormatCompFlags): number {
        switch (flags) {
        case FormatCompFlags.COMP_R:
            return 1;
        case FormatCompFlags.COMP_RG:
            return 2;
        case FormatCompFlags.COMP_RGB:
            return 3;
        case FormatCompFlags.COMP_RGBA:
            return 4;
        }
    }

    const typeFlags: FormatTypeFlags = getFormatTypeFlags(fmt);
    const compFlags: FormatCompFlags = getFormatCompFlags(fmt);
    const flags: FormatFlags = fmt & 0xFF;

    const type = translateType(typeFlags);
    const size = translateSize(compFlags);
    const normalized = !!(flags & FormatFlags.NORMALIZED);
    return { size, type, normalized };
}

function translateIndexFormat(format: GfxFormat): GLenum {
    switch (format) {
    case GfxFormat.U8_R:
        return WebGL2RenderingContext.UNSIGNED_BYTE;
    case GfxFormat.U16_R:
        return WebGL2RenderingContext.UNSIGNED_SHORT;
    case GfxFormat.U32_R:
        return WebGL2RenderingContext.UNSIGNED_INT;
    default:
        throw "whoops";
    }
}

function translateBufferHint(hint: GfxBufferFrequencyHint): GLenum {
    switch (hint) {
    case GfxBufferFrequencyHint.STATIC:
        return WebGL2RenderingContext.STATIC_DRAW;
    case GfxBufferFrequencyHint.DYNAMIC:
        return WebGL2RenderingContext.DYNAMIC_DRAW;
    }
}

function translateBufferUsageToTarget(usage: GfxBufferUsage): GLenum {
    switch (usage) {
    case GfxBufferUsage.INDEX:
        return WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER;
    case GfxBufferUsage.VERTEX:
        return WebGL2RenderingContext.ARRAY_BUFFER;
    case GfxBufferUsage.UNIFORM:
        return WebGL2RenderingContext.UNIFORM_BUFFER;
    }
}

function translateWrapMode(wrapMode: GfxWrapMode): GLenum {
    switch (wrapMode) {
    case GfxWrapMode.CLAMP:
        return WebGL2RenderingContext.CLAMP_TO_EDGE;
    case GfxWrapMode.REPEAT:
        return WebGL2RenderingContext.REPEAT;
    case GfxWrapMode.MIRROR:
        return WebGL2RenderingContext.MIRRORED_REPEAT;
    }
}

function translateFilterMode(filter: GfxTexFilterMode, mipFilter: GfxMipFilterMode): GLenum {
    if (mipFilter === GfxMipFilterMode.LINEAR && filter === GfxTexFilterMode.BILINEAR)
        return WebGL2RenderingContext.LINEAR_MIPMAP_LINEAR;
    if (mipFilter === GfxMipFilterMode.LINEAR && filter === GfxTexFilterMode.POINT)
        return WebGL2RenderingContext.NEAREST_MIPMAP_LINEAR;
    if (mipFilter === GfxMipFilterMode.NEAREST && filter === GfxTexFilterMode.BILINEAR)
        return WebGL2RenderingContext.LINEAR_MIPMAP_NEAREST;
    if (mipFilter === GfxMipFilterMode.NEAREST && filter === GfxTexFilterMode.POINT)
        return WebGL2RenderingContext.NEAREST_MIPMAP_NEAREST;
    if (mipFilter === GfxMipFilterMode.NO_MIP && filter === GfxTexFilterMode.BILINEAR)
        return WebGL2RenderingContext.LINEAR;
    if (mipFilter === GfxMipFilterMode.NO_MIP && filter === GfxTexFilterMode.POINT)
        return WebGL2RenderingContext.NEAREST;
    throw new Error(`Unknown texture filter mode`);
}

function translatePrimitiveTopology(topology: GfxPrimitiveTopology): GLenum {
    switch (topology) {
    case GfxPrimitiveTopology.TRIANGLES:
        return WebGL2RenderingContext.TRIANGLES;
    default:
        throw new Error("Unknown primitive topology mode");
    }
}

export function getPlatformBuffer(buffer_: GfxBuffer, byteOffset: number = 0): WebGLBuffer {
    const buffer = buffer_ as GfxBufferP_GL;
    return buffer.gl_buffer_pages[(byteOffset / buffer.pageByteSize) | 0];
}

export function getPlatformTexture(texture_: GfxTexture): WebGLTexture {
    const texture = texture_ as GfxTextureP_GL;
    return texture.gl_texture;
}

export function getPlatformSampler(sampler_: GfxSampler): WebGLSampler {
    const sampler = sampler_ as GfxSamplerP_GL;
    return sampler.gl_sampler;
}

export function getPlatformColorAttachment(colorAttachment_: GfxColorAttachment): WebGLRenderbuffer {
    const colorAttachment = colorAttachment_ as GfxColorAttachmentP_GL;
    return colorAttachment.gl_renderbuffer;
}

export function getPlatformDepthStencilAttachment(depthStencilAttachment_: GfxDepthStencilAttachment): WebGLRenderbuffer {
    const depthStencilAttachment = depthStencilAttachment_ as GfxDepthStencilAttachmentP_GL;
    return depthStencilAttachment.gl_renderbuffer;
}

export function getPlatformRenderTarget(renderTarget_: GfxRenderTarget): WebGLFramebuffer {
    const renderTarget = renderTarget_ as GfxRenderTargetP_GL;
    return renderTarget.gl_framebuffer;
}

function assignPlatformName(o: any, name: string): void {
    o.name = name;
    o.__SPECTOR_Metadata = { name };
}

function createBindingLayouts(bindingLayouts: GfxBindingLayoutDescriptor[]): GfxBindingLayoutsP_GL {
    let firstUniformBuffer = 0, firstSampler = 0;
    const bindingLayoutTables: GfxBindingLayoutTableP_GL[] = [];
    for (let i = 0; i < bindingLayouts.length; i++) {
        const { numUniformBuffers, numSamplers } = bindingLayouts[i];
        bindingLayoutTables.push({ firstUniformBuffer, numUniformBuffers, firstSampler, numSamplers });
        firstUniformBuffer += numUniformBuffers;
        firstSampler += numSamplers;
    }
    return { numUniformBuffers: firstUniformBuffer, numSamplers: firstSampler, bindingLayoutTables };
}

type ArrayBufferView2 = Float32Array | Uint32Array;
class Growable<T extends ArrayBufferView2> {
    public b: T;
    public i: number;
    public o: number;

    constructor(public m: (n: number) => T, public a: number = 0x400) {
        this.i = this.a;
        this.b = m(this.i);
        this.o = 0;
    }

    public r() {
        this.o = 0;
    }

    public n(v: number) {
        if (this.o + 1 > this.b.length) {
            const b = this.m(this.b.length + this.a);
            b.set(this.b);
            this.b = b;
        }

        this.b[this.o++] = v;
    }
}

const enum RenderPassCmd { setRenderPassParameters = 471, setViewport, setBindings, setPipeline, setInputState, setStencilRef, draw, drawIndexed, endPass, invalid = 0x1234 };
class GfxRenderPassP_GL implements GfxRenderPass {
    public u32: Growable<Uint32Array> = new Growable((n) => new Uint32Array(n));
    public f32: Growable<Float32Array> = new Growable((n) => new Float32Array(n));
    public o: (object | null)[] = [];

    public reset() { this.u32.r(); this.f32.r(); this.o.length = 0; }

    public pu32(c: number) { this.u32.n(c); }
    public pcmd(c: number) { this.pu32(c); }
    public pf32(c: number) { this.f32.n(c); }
    public po(r: object | null) { this.o.push(r); }

    public end() { this.pcmd(RenderPassCmd.invalid); }
    public setRenderPassParameters(t: GfxRenderTarget, c: number, r: number, g: number, b: number, a: number, d: number, s: number) { this.pcmd(RenderPassCmd.setRenderPassParameters); this.po(t); this.pu32(c); this.pf32(r); this.pf32(g); this.pf32(b); this.pf32(a); this.pf32(d); this.pf32(s); }
    public setViewport(w: number, h: number)      { this.pcmd(RenderPassCmd.setViewport); this.pf32(w); this.pf32(h); }
    public setPipeline(r: GfxRenderPipeline)      { this.pcmd(RenderPassCmd.setPipeline); this.po(r); }
    public setBindings(n: number, r: GfxBindings, o: number[]) { this.pcmd(RenderPassCmd.setBindings); this.pu32(n); this.po(r); this.pu32(o.length); for (let i = 0; i < o.length; i++) this.pu32(o[i]); }
    public setInputState(r: GfxInputState | null) { this.pcmd(RenderPassCmd.setInputState); this.po(r); }
    public setStencilRef(v: number)               { this.pcmd(RenderPassCmd.setStencilRef); this.pf32(v); }
    public draw(a: number, b: number)             { this.pcmd(RenderPassCmd.draw); this.pu32(a); this.pu32(b); }
    public drawIndexed(a: number, b: number)      { this.pcmd(RenderPassCmd.drawIndexed); this.pu32(a); this.pu32(b); }
    public endPass(r: GfxTexture | null)          { this.pcmd(RenderPassCmd.endPass); this.po(r); }
}

enum HostAccessPassCmd { uploadBufferData = 491, uploadTextureData, end };
class GfxHostAccessPassP_GL implements GfxHostAccessPass {
    public u32: Growable<Uint32Array> = new Growable((n) => new Uint32Array(n));
    public gfxr: GfxResource[] = [];
    public bufr: ArrayBufferView[] = [];

    public reset() { this.u32.r(); this.gfxr.length = 0; this.bufr.length = 0; }

    public pu32(c: number) { this.u32.n(c); }
    public pcmd(c: number) { this.pu32(c); }
    public pgfxr(r: GfxResource | null) { this.gfxr.push(r); }
    public pbufr(r: ArrayBufferView) { this.bufr.push(r); }

    public end() { this.pcmd(HostAccessPassCmd.end); }
    public uploadBufferData(r: GfxBuffer, dstWordOffset: number, data: Uint8Array, srcWordOffset?: number, wordCount?: number) {
        assert(!!r);
        this.pcmd(HostAccessPassCmd.uploadBufferData); this.pgfxr(r);
        const dstByteOffset = dstWordOffset * 4;
        const srcByteOffset = (srcWordOffset !== undefined) ? (srcWordOffset * 4) : 0;
        const byteCount = (wordCount !== undefined) ? (wordCount * 4) : (data.byteLength - srcByteOffset);
        this.pu32(dstByteOffset);
        this.pbufr(data);
        this.pu32(srcByteOffset);
        this.pu32(byteCount);
    }

    public uploadTextureData(r: GfxTexture, firstMipLevel: number, levelDatas: ArrayBufferView[]) {
        this.pcmd(HostAccessPassCmd.uploadTextureData); this.pgfxr(r);
        this.pu32(firstMipLevel);
        this.pu32(levelDatas.length);
        for (let i = 0; i < levelDatas.length; i++) this.pbufr(levelDatas[i]);
    }
}

export function applyMegaState(gl: WebGL2RenderingContext, currentMegaState: GfxMegaStateDescriptor, newMegaState: GfxMegaStateDescriptor): void {
    if (currentMegaState.colorWrite !== newMegaState.colorWrite) {
        gl.colorMask(newMegaState.colorWrite, newMegaState.colorWrite, newMegaState.colorWrite, newMegaState.colorWrite);
        currentMegaState.colorWrite = newMegaState.colorWrite;
    }

    if (currentMegaState.blendMode !== newMegaState.blendMode) {
        if (currentMegaState.blendMode === GfxBlendMode.NONE)
            gl.enable(gl.BLEND);
        else if (newMegaState.blendMode === GfxBlendMode.NONE)
            gl.disable(gl.BLEND);

        if (newMegaState.blendMode !== GfxBlendMode.NONE)
            gl.blendEquation(newMegaState.blendMode);
        currentMegaState.blendMode = newMegaState.blendMode;
    }

    if (currentMegaState.blendSrcFactor !== newMegaState.blendSrcFactor ||
        currentMegaState.blendDstFactor !== newMegaState.blendDstFactor) {
        gl.blendFunc(newMegaState.blendSrcFactor, newMegaState.blendDstFactor);
        currentMegaState.blendSrcFactor = newMegaState.blendSrcFactor;
        currentMegaState.blendDstFactor = newMegaState.blendDstFactor;
    }

    if (currentMegaState.depthCompare !== newMegaState.depthCompare) {
        if (currentMegaState.depthCompare === GfxCompareMode.ALWAYS)
            gl.enable(gl.DEPTH_TEST);
        else if (newMegaState.depthCompare === GfxCompareMode.ALWAYS)
            gl.disable(gl.DEPTH_TEST);

        if (newMegaState.depthCompare !== GfxCompareMode.ALWAYS)
            gl.depthFunc(newMegaState.depthCompare);
        currentMegaState.depthCompare = newMegaState.depthCompare;
    }

    if (currentMegaState.depthWrite !== newMegaState.depthWrite) {
        gl.depthMask(newMegaState.depthWrite);
        currentMegaState.depthWrite = newMegaState.depthWrite;
    }

    if (currentMegaState.stencilCompare !== newMegaState.stencilCompare) {
        // TODO(jstpierre): Store the stencil ref somewhere.
        const stencilRef = gl.getParameter(gl.STENCIL_REF);
        gl.stencilFunc(newMegaState.stencilCompare, stencilRef, 0xFF);
        currentMegaState.stencilCompare = newMegaState.stencilCompare;
    }

    if (currentMegaState.stencilWrite !== newMegaState.stencilWrite) {
        gl.stencilMask(newMegaState.stencilWrite ? 0xFF : 0x00);
        currentMegaState.stencilWrite = newMegaState.stencilWrite;
    }

    if (currentMegaState.stencilWrite) {
        if (currentMegaState.stencilPassOp !== newMegaState.stencilPassOp) {
            gl.stencilOp(gl.KEEP, gl.KEEP, newMegaState.stencilPassOp);
            currentMegaState.stencilPassOp = newMegaState.stencilPassOp;
        }
    }

    if (currentMegaState.cullMode !== newMegaState.cullMode) {
        if (currentMegaState.cullMode === GfxCullMode.NONE)
            gl.enable(gl.CULL_FACE);
        else if (newMegaState.cullMode === GfxCullMode.NONE)
            gl.disable(gl.CULL_FACE);

        if (newMegaState.cullMode === GfxCullMode.BACK)
            gl.cullFace(gl.BACK);
        else if (newMegaState.cullMode === GfxCullMode.FRONT)
            gl.cullFace(gl.FRONT);
        else if (newMegaState.cullMode === GfxCullMode.FRONT_AND_BACK)
            gl.cullFace(gl.FRONT_AND_BACK);
        currentMegaState.cullMode = newMegaState.cullMode;
    }

    if (currentMegaState.frontFace !== newMegaState.frontFace) {
        gl.frontFace(newMegaState.frontFace);
        currentMegaState.frontFace = newMegaState.frontFace;
    }

    if (currentMegaState.polygonOffset !== newMegaState.polygonOffset) {
        if (newMegaState.polygonOffset) {
            gl.polygonOffset(-0.5, -0.5);
            gl.enable(gl.POLYGON_OFFSET_FILL);
        } else {
            gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        currentMegaState.polygonOffset = newMegaState.polygonOffset;
    }
}

class GfxImplP_GL implements GfxSwapChain, GfxDevice {
    private _fullscreenCopyMegaState = fullscreenFlags.resolveMegaState();
    private _fullscreenCopyProgram: GfxProgramP_GL;

    private _WEBGL_compressed_texture_s3tc: WEBGL_compressed_texture_s3tc | null;
    private _WEBGL_compressed_texture_s3tc_srgb: WEBGL_compressed_texture_s3tc_srgb | null;

    private _currentRenderTarget: GfxRenderTargetP_GL;
    private _currentPipeline: GfxRenderPipelineP_GL;
    private _currentInputState: GfxInputStateP_GL;
    private _currentMegaState: GfxMegaStateDescriptor = new RenderFlags(defaultFlags).resolveMegaState();
    private _currentSamplers: WebGLSampler[] = [];
    private _currentTextures: WebGLTexture[] = [];
    private _debugGroupStack: GfxDebugGroup[] = [];

    constructor(public gl: WebGL2RenderingContext, programCache: ProgramCache | null = null, private isTransitionDevice: boolean = false) {
        this._WEBGL_compressed_texture_s3tc = gl.getExtension('WEBGL_compressed_texture_s3tc');
        this._WEBGL_compressed_texture_s3tc_srgb = gl.getExtension('WEBGL_compressed_texture_s3tc_srgb');

        if (programCache !== null) {
            this._programCache = programCache;
        } else {
            this._programCache = new ProgramCache(gl);
        }

        if (!this.isTransitionDevice) {
            this._fullscreenCopyProgram = this.createProgram(new FullscreenCopyProgram()) as GfxProgramP_GL;
        }

        this._currentMegaState.depthCompare = GfxCompareMode.ALWAYS;
    }

    //#region GfxSwapChain
    private _scWidth: number = 0;
    private _scHeight: number = 0;
    private _scTexture: GfxTexture | null = null;
    public configureSwapChain(width: number, height: number): void {
        if (this._scWidth !== width || this._scHeight !== height) {
            const gl = this.gl;

            this._scWidth = width;
            this._scHeight = height;

            if (this._scTexture !== null)
                this.destroyTexture(this._scTexture);

            this._scTexture = this.createTexture(GfxFormat.U8_RGBA, this._scWidth, this._scHeight, 1);
            gl.bindTexture(gl.TEXTURE_2D, getPlatformTexture(this._scTexture));
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
    }

    public getDevice(): GfxDevice {
        return this;
    }

    public getOnscreenTexture(): GfxTexture {
        return this._scTexture;
    }

    public present(): void {
        this.blitFullscreenTexture(this._scTexture);
    }

    private blitFullscreenTexture(texture: GfxTexture): void {
        const gl = this.gl;
        this._setMegaState(this._fullscreenCopyMegaState);
        this._setActiveTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, getPlatformTexture(texture));
        gl.bindSampler(0, null);
        this._currentTextures[0] = null;
        this._useProgram(this._fullscreenCopyProgram.gl_program);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    //#endregion

    //#region GfxDevice
    private translateTextureInternalFormat(fmt: GfxFormat): GLenum {
        switch (fmt) {
        case GfxFormat.F32_R:
            return WebGL2RenderingContext.R32F;
        case GfxFormat.F32_RG:
            return WebGL2RenderingContext.RG32F;
        case GfxFormat.F32_RGB:
            return WebGL2RenderingContext.RGB32F;
        case GfxFormat.F32_RGBA:
            return WebGL2RenderingContext.RGBA32F;
        case GfxFormat.U16_R:
            return WebGL2RenderingContext.R16UI;
        case GfxFormat.U8_RGBA:
            return WebGL2RenderingContext.RGBA8;
        case GfxFormat.U8_RGBA_SRGB:
            return WebGL2RenderingContext.SRGB8_ALPHA8;
        case GfxFormat.S8_RGBA_NORM:
            return WebGL2RenderingContext.RGBA8_SNORM;
        case GfxFormat.BC1:
            return this._WEBGL_compressed_texture_s3tc.COMPRESSED_RGBA_S3TC_DXT1_EXT;
        case GfxFormat.BC1_SRGB:
            return this._WEBGL_compressed_texture_s3tc.COMPRESSED_RGBA_S3TC_DXT5_EXT;
        case GfxFormat.BC3:
            return this._WEBGL_compressed_texture_s3tc_srgb.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
        case GfxFormat.BC3_SRGB:
            return this._WEBGL_compressed_texture_s3tc_srgb.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
        default:
            throw "whoops";
        }
    }
    
    private translateTextureFormat(fmt: GfxFormat): GLenum {
        const compFlags: FormatCompFlags = getFormatCompFlags(fmt);
        switch (compFlags) {
        case FormatCompFlags.COMP_R:
            return WebGL2RenderingContext.RED;
        case FormatCompFlags.COMP_RG:
            return WebGL2RenderingContext.RG;
        case FormatCompFlags.COMP_RGB:
            return WebGL2RenderingContext.RGB;
        case FormatCompFlags.COMP_RGBA:
            return WebGL2RenderingContext.RGBA;
        }
    }
    
    private translateTextureType(fmt: GfxFormat): GLenum {
        const typeFlags: FormatTypeFlags = getFormatTypeFlags(fmt);
        switch (typeFlags) {
        case FormatTypeFlags.U8:
            return WebGL2RenderingContext.UNSIGNED_BYTE;
        case FormatTypeFlags.S8:
            return WebGL2RenderingContext.BYTE;
        default:
            throw "whoops";
        }
    }

    private isTextureFormatCompressed(fmt: GfxFormat): boolean {
        const typeFlags: FormatTypeFlags = getFormatTypeFlags(fmt);
        switch (typeFlags) {
        case FormatTypeFlags.BC1:
        case FormatTypeFlags.BC3:
            return true;
        default:
            return false;
        }
    }

    private _currentActiveTexture: GLenum | null = null;
    private _setActiveTexture(texture: GLenum): void {
        if (this._currentActiveTexture !== texture) {
            this.gl.activeTexture(texture);
            this._currentActiveTexture = texture;
        }
    }

    private _currentBoundVAO: WebGLVertexArrayObject = null;
    private _bindVAO(vao: WebGLVertexArrayObject | null): void {
        if (this._currentBoundVAO !== vao) {
            this.gl.bindVertexArray(vao);
            this._currentBoundVAO = vao;
        }
    }

    private _currentBoundBuffers: WebGLBuffer[] = [];
    private _bindBuffer(gl_target: GLenum, gl_buffer: WebGLBuffer, force: boolean = false): void {
        if (this._currentBoundBuffers[gl_target] !== gl_buffer || force) {
            this._bindVAO(null);
            this.gl.bindBuffer(gl_target, gl_buffer);
            this._currentBoundBuffers[gl_target] = gl_buffer;
        }
    }

    private _currentProgram: WebGLProgram | null = null;
    private _useProgram(program: WebGLProgram): void {
        if (this._currentProgram !== program) {
            this.gl.useProgram(program);
            this._currentProgram = program;
        }
    }

    private _createBufferPage(byteSize: number, usage: GfxBufferUsage, hint: GfxBufferFrequencyHint): WebGLBuffer {
        const gl = this.gl;
        const gl_buffer = gl.createBuffer();
        const gl_target = translateBufferUsageToTarget(usage);
        const gl_hint = translateBufferHint(hint);
        this._bindBuffer(gl_target, gl_buffer);
        gl.bufferData(gl_target, byteSize, gl_hint);
        return gl_buffer;
    }

    public createBuffer(wordCount: number, usage: GfxBufferUsage, hint: GfxBufferFrequencyHint): GfxBuffer {
        const byteSize = wordCount * 4;
        const gl_buffer_pages: WebGLBuffer[] = [];

        let pageByteSize: number;
        if (usage === GfxBufferUsage.UNIFORM) {
            // This is a workaround for ANGLE not supporting UBOs greater than 64kb (the limit of D3D).
            // It seems like this is a bug because there is supposed to be code to handle it, but it doesn't appear to work.
            const UBO_PAGE_BYTE_SIZE = 0x10000;

            let byteSizeLeft = byteSize;
            while (byteSizeLeft > 0) {
                gl_buffer_pages.push(this._createBufferPage(Math.min(byteSizeLeft, UBO_PAGE_BYTE_SIZE), usage, hint));
                byteSizeLeft -= UBO_PAGE_BYTE_SIZE;
            }

            pageByteSize = UBO_PAGE_BYTE_SIZE;
        } else {
            gl_buffer_pages.push(this._createBufferPage(byteSize, usage, hint));
            pageByteSize = byteSize;
        }

        const gl_target = translateBufferUsageToTarget(usage);
        const buffer: GfxBufferP_GL = { _T: _T.Buffer, gl_buffer_pages, gl_target, usage, byteSize, pageByteSize };
        return buffer;
    }

    public createTexture_(descriptor: GfxTextureDescriptor): GfxTexture {
        const gl = this.gl;
        const gl_texture = gl.createTexture();
        let gl_target: GLenum;
        const internalformat = this.translateTextureInternalFormat(descriptor.pixelFormat);
        this._setActiveTexture(gl.TEXTURE0);
        this._currentTextures[0] = null;
        if (descriptor.dimension === GfxTextureDimension.n2D) {
            gl_target = WebGL2RenderingContext.TEXTURE_2D;
            gl.bindTexture(gl_target, gl_texture);
            gl.texStorage2D(gl_target, descriptor.numLevels, internalformat, descriptor.width, descriptor.height);
            assert(descriptor.depth === 1);
        } else if (descriptor.dimension === GfxTextureDimension.n2D_ARRAY) {
            gl_target = WebGL2RenderingContext.TEXTURE_2D_ARRAY;
            gl.bindTexture(gl_target, gl_texture);
            gl.texStorage3D(gl_target, descriptor.numLevels, internalformat, descriptor.width, descriptor.height, descriptor.depth);
        }
        const texture: GfxTextureP_GL = { _T: _T.Texture, gl_texture, gl_target,
            pixelFormat: descriptor.pixelFormat,
            width: descriptor.width,
            height: descriptor.height,
            depth: descriptor.depth,
        };
        return texture;
    }

    public createTexture(format: GfxFormat, width: number, height: number, numLevels: number): GfxTexture {
        return this.createTexture_(makeTextureDescriptor2D(format, width, height, numLevels));
    }

    public createSampler(descriptor: GfxSamplerDescriptor): GfxSampler {
        const gl = this.gl;
        const gl_sampler = gl.createSampler();
        gl.samplerParameteri(gl_sampler, gl.TEXTURE_WRAP_S, translateWrapMode(descriptor.wrapS));
        gl.samplerParameteri(gl_sampler, gl.TEXTURE_WRAP_T, translateWrapMode(descriptor.wrapT));
        gl.samplerParameteri(gl_sampler, gl.TEXTURE_MIN_FILTER, translateFilterMode(descriptor.minFilter, descriptor.mipFilter));
        gl.samplerParameteri(gl_sampler, gl.TEXTURE_MAG_FILTER, translateFilterMode(descriptor.magFilter, GfxMipFilterMode.NO_MIP));
        gl.samplerParameterf(gl_sampler, gl.TEXTURE_MIN_LOD, descriptor.minLOD);
        gl.samplerParameterf(gl_sampler, gl.TEXTURE_MAX_LOD, descriptor.maxLOD);
        const sampler: GfxSamplerP_GL = { _T: _T.Sampler, gl_sampler };
        return sampler;
    }

    public createColorAttachment(width: number, height: number, numSamples: number): GfxColorAttachment {
        const gl = this.gl;
        const gl_renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, gl_renderbuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, numSamples, gl.RGBA8, width, height);
        const colorAttachment: GfxColorAttachmentP_GL = { _T: _T.ColorAttachment, gl_renderbuffer, width, height };
        return colorAttachment;
    }

    public createDepthStencilAttachment(width: number, height: number, numSamples: number): GfxDepthStencilAttachment {
        const gl = this.gl;
        const gl_renderbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, gl_renderbuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, numSamples, gl.DEPTH24_STENCIL8, width, height);
        const depthStencilAttachment: GfxDepthStencilAttachmentP_GL = { _T: _T.DepthStencilAttachment, gl_renderbuffer, width, height };
        return depthStencilAttachment;
    }

    public createRenderTarget(descriptor: GfxRenderTargetDescriptor): GfxRenderTarget {
        const gl = this.gl;
        const gl_framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gl_framebuffer);
        if (descriptor.colorAttachment !== null)
            gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, getPlatformColorAttachment(descriptor.colorAttachment));
        if (descriptor.depthStencilAttachment !== null)
            gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, getPlatformDepthStencilAttachment(descriptor.depthStencilAttachment));
        const colorAttachment = descriptor.colorAttachment as GfxColorAttachmentP_GL;
        const depthAttachment = descriptor.depthStencilAttachment as GfxDepthStencilAttachmentP_GL;
        const renderTarget: GfxRenderTargetP_GL = { _T: _T.RenderTarget, gl_framebuffer, colorAttachment, depthAttachment };
        return renderTarget;
    }

    private _programCache: ProgramCache;
    public createProgram(deviceProgram: DeviceProgram): GfxProgram {
        const gl = this.gl;
        const gl_program = deviceProgram.compile(gl, this._programCache);
        const program: GfxProgramP_GL = { _T: _T.Program, gl_program, deviceProgram };
        return program;
    }

    public createBindings(descriptor: GfxBindingsDescriptor): GfxBindings {
        const { bindingLayout, uniformBufferBindings, samplerBindings } = descriptor;
        assert(bindingLayout.numUniformBuffers === uniformBufferBindings.length);
        assert(bindingLayout.numSamplers === samplerBindings.length);
        const bindings: GfxBindingsP_GL = { _T: _T.Bindings, uniformBufferBindings, samplerBindings };
        return bindings;
    }

    public createInputLayout(inputLayoutDescriptor: GfxInputLayoutDescriptor): GfxInputLayout {
        const { vertexAttributeDescriptors, indexBufferFormat } = inputLayoutDescriptor;
        const inputLayout: GfxInputLayoutP_GL = { _T: _T.InputLayout, vertexAttributeDescriptors, indexBufferFormat };
        return inputLayout;
    }

    public createInputState(inputLayout_: GfxInputLayout, vertexBuffers: GfxVertexBufferDescriptor[], indexBufferBinding: GfxVertexBufferDescriptor | null): GfxInputState {
        const inputLayout = inputLayout_ as GfxInputLayoutP_GL;

        const gl = this.gl;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        for (let i = 0; i < inputLayout.vertexAttributeDescriptors.length; i++) {
            const attr = inputLayout.vertexAttributeDescriptors[i];
            const { size, type, normalized } = translateVertexFormat(attr.format);
            const vertexBuffer = vertexBuffers[attr.bufferIndex];

            const buffer = vertexBuffer.buffer as GfxBufferP_GL;
            assert(buffer.usage === GfxBufferUsage.VERTEX);
            gl.bindBuffer(gl.ARRAY_BUFFER, getPlatformBuffer(vertexBuffer.buffer));

            const bufferOffset = vertexBuffer.byteOffset + attr.bufferByteOffset;
            // TODO(jstpierre): How do we support glVertexAttribIPointer without too much insanity?
            if (attr.usesIntInShader) {
                gl.vertexAttribIPointer(attr.location, size, type, vertexBuffer.byteStride, bufferOffset);
            } else {
                gl.vertexAttribPointer(attr.location, size, type, normalized, vertexBuffer.byteStride, bufferOffset);
            }

            if (attr.frequency === GfxVertexAttributeFrequency.PER_INSTANCE) {
                gl.vertexAttribDivisor(attr.location, 1);
            }

            gl.enableVertexAttribArray(attr.location);
        }

        let indexBufferType: GLenum | null = null;
        let indexBufferCompByteSize: number | null = null;
        let indexBufferByteOffset: number | null = null;
        if (indexBufferBinding !== null) {
            const buffer = indexBufferBinding.buffer as GfxBufferP_GL;
            assert(buffer.usage === GfxBufferUsage.INDEX);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, getPlatformBuffer(indexBufferBinding.buffer));
            indexBufferType = translateIndexFormat(inputLayout.indexBufferFormat);
            indexBufferCompByteSize = getFormatCompByteSize(inputLayout.indexBufferFormat);
            indexBufferByteOffset = indexBufferBinding.byteOffset;
        }

        gl.bindVertexArray(null);

        const inputState: GfxInputStateP_GL = { _T: _T.InputState, vao, indexBufferByteOffset, indexBufferType, indexBufferCompByteSize, inputLayout };
        return inputState;
    }

    public createRenderPipeline(descriptor: GfxRenderPipelineDescriptor): GfxRenderPipeline {
        const bindingLayouts = createBindingLayouts(descriptor.bindingLayouts);
        const drawMode = translatePrimitiveTopology(descriptor.topology);
        const program = descriptor.program as GfxProgramP_GL;
        assert(program.deviceProgram.uniformBufferLayouts.length === bindingLayouts.numUniformBuffers);
        const megaState = descriptor.megaStateDescriptor;
        const inputLayout = descriptor.inputLayout as GfxInputLayoutP_GL | null;
        const pipeline: GfxRenderPipelineP_GL = { _T: _T.RenderPipeline, bindingLayouts, drawMode, program, megaState, inputLayout };
        return pipeline;
    }

    public destroyBuffer(o: GfxBuffer): void {
        const { gl_buffer_pages } = o as GfxBufferP_GL;
        for (let i = 0; i < gl_buffer_pages.length; i++)
            this.gl.deleteBuffer(gl_buffer_pages[i]);
    }

    public destroyTexture(o: GfxTexture): void {
        this.gl.deleteTexture(getPlatformTexture(o));
    }

    public destroySampler(o: GfxSampler): void {
        this.gl.deleteSampler(getPlatformSampler(o));
    }

    public destroyColorAttachment(o: GfxColorAttachment): void {
        this.gl.deleteRenderbuffer(getPlatformColorAttachment(o));
    }

    public destroyDepthStencilAttachment(o: GfxDepthStencilAttachment): void {
        this.gl.deleteRenderbuffer(getPlatformDepthStencilAttachment(o));
    }

    public destroyRenderTarget(o: GfxRenderTarget): void {
        this.gl.deleteFramebuffer(getPlatformRenderTarget(o));
    }

    public destroyProgram(o: GfxProgram): void {
        // Nothing.
    }

    public destroyBindings(o: GfxBindings): void {
        // Nothing.
    }

    public destroyInputLayout(o: GfxInputLayout): void {
        // Nothing.
    }

    public destroyInputState(o: GfxInputState): void {
        const inputState = o as GfxInputStateP_GL;
        this.gl.deleteVertexArray(inputState.vao);
    }

    public destroyRenderPipeline(o: GfxRenderPipeline): void {
        // Nothing.
    }

    private _hostAccessPassPool: GfxHostAccessPassP_GL[] = [];
    public createHostAccessPass(): GfxHostAccessPass {
        const pass = this._hostAccessPassPool.length > 0 ? this._hostAccessPassPool.pop() : new GfxHostAccessPassP_GL();
        return pass;
    }

    private _renderPassPool: GfxRenderPassP_GL[] = [];
    public createRenderPass(renderTarget: GfxRenderTarget, descriptor: GfxRenderPassDescriptor): GfxRenderPassP_GL {
        if (this.isTransitionDevice)
            throw "whoops";

        const pass = this._renderPassPool.length > 0 ? this._renderPassPool.pop() : new GfxRenderPassP_GL();

        const shouldClearColor = descriptor.colorLoadDisposition === GfxLoadDisposition.CLEAR;
        const shouldClearDepth = descriptor.depthLoadDisposition === GfxLoadDisposition.CLEAR;
        const shouldClearStencil = descriptor.stencilLoadDisposition === GfxLoadDisposition.CLEAR;
        
        let clearBits = 0;
        if (shouldClearColor)
            clearBits |= WebGL2RenderingContext.COLOR_BUFFER_BIT;
        if (shouldClearDepth)
            clearBits |= WebGL2RenderingContext.DEPTH_BUFFER_BIT;
        if (shouldClearStencil)
            clearBits |= WebGL2RenderingContext.STENCIL_BUFFER_BIT;
        
        const { colorClearColor, depthClearValue, stencilClearValue } = descriptor;

        pass.setRenderPassParameters(renderTarget, clearBits, colorClearColor.r, colorClearColor.g, colorClearColor.b, colorClearColor.a, depthClearValue, stencilClearValue);
        return pass;
    }

    public submitPass(o: GfxPass): void {
        if (o instanceof GfxRenderPassP_GL) {
            o.end();
            this.executeRenderPass(o.u32.b, o.f32.b, o.o);
            o.reset();
            this._renderPassPool.push(o);
        } else if (o instanceof GfxHostAccessPassP_GL) {
            o.end();
            this.executeHostAccessPass(o.u32.b, o.gfxr, o.bufr);
            o.reset();
            this._hostAccessPassPool.push(o);
        }
    }

    public queryLimits(): GfxDeviceLimits {
        const gl = this.gl;
        return {
            uniformBufferWordAlignment: gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT) / 4,
        };
    }

    public queryProgram(program_: GfxProgram): GfxProgramReflection {
        const program = program_ as GfxProgramP_GL;
        return program.deviceProgram;
    }

    public queryInputState(inputState_: GfxInputState): GfxInputStateReflection {
        const inputState = inputState_ as GfxInputStateP_GL;
        const inputLayout = inputState.inputLayout;
        return { inputLayout };
    }

    public queryTextureFormatSupported(format: GfxFormat): boolean {
        switch (format) {
        case GfxFormat.BC1_SRGB:
        case GfxFormat.BC3_SRGB:
            return this._WEBGL_compressed_texture_s3tc_srgb !== null;
        case GfxFormat.BC1:
        case GfxFormat.BC3:
            return this._WEBGL_compressed_texture_s3tc !== null;
        default:
            return true;
        }
    }

    public setResourceName(o: GfxResource, name: string): void {
        o.ResourceName = name;

        if (o._T === _T.Buffer) {
            const { gl_buffer_pages } = o as GfxBufferP_GL;
            for (let i = 0; i < gl_buffer_pages.length; i++)
                assignPlatformName(gl_buffer_pages[i], `${name} Page ${i}`);
        } else if (o._T === _T.Texture)
            assignPlatformName(getPlatformTexture(o), name);
        else if (o._T === _T.Sampler)
            assignPlatformName(getPlatformSampler(o), name);
        else if (o._T === _T.RenderTarget)
            assignPlatformName(getPlatformRenderTarget(o), name);
        else if (o._T === _T.ColorAttachment)
            assignPlatformName(getPlatformColorAttachment(o), name);
        else if (o._T === _T.DepthStencilAttachment)
            assignPlatformName(getPlatformDepthStencilAttachment(o), name);
        else if (o._T === _T.InputState)
            assignPlatformName((o as GfxInputStateP_GL).vao, name);
    }

    public pushDebugGroup(debugGroup: GfxDebugGroup): void {
        this._debugGroupStack.push(debugGroup);
    }

    public popDebugGroup(): GfxDebugGroup {
        return this._debugGroupStack.pop();
    }
    //#endregion

    // Debugging.
    public getBufferData(buffer: GfxBuffer, dstBuffer: ArrayBufferView, wordOffset: number = 0): void {
        const gl = this.gl;
        const { gl_target } = buffer as GfxBufferP_GL;
        this._bindBuffer(gl_target, getPlatformBuffer(buffer, wordOffset * 4));
        gl.getBufferSubData(gl_target, wordOffset * 4, dstBuffer);
    }

    //#region Pass execution
    public executeRenderPass(u32: Uint32Array, f32: Float32Array, gfxr: (object | null)[]): void {
        let iu32 = 0, if32 = 0, igfxr = 0;
        while (true) {
            const cmd = u32[iu32++] as RenderPassCmd;

            if (cmd === RenderPassCmd.setRenderPassParameters) {
                this.setRenderPassParameters(gfxr[igfxr++] as GfxRenderTarget, u32[iu32++], f32[if32++], f32[if32++], f32[if32++], f32[if32++], f32[if32++], f32[if32++]);
            } else if (cmd === RenderPassCmd.setViewport) {
                this.setViewport(f32[if32++], f32[if32++]);
            } else if (cmd === RenderPassCmd.setBindings) {
                const index = u32[iu32++], numOffsets = u32[iu32++];
                this.setBindings(index, gfxr[igfxr++] as GfxBindings, numOffsets, u32, iu32);
                iu32 += numOffsets;
            } else if (cmd === RenderPassCmd.setPipeline) {
                this.setPipeline(gfxr[igfxr++] as GfxRenderPipeline);
            } else if (cmd === RenderPassCmd.setInputState) {
                this.setInputState(gfxr[igfxr++] as GfxInputState | null);
            } else if (cmd === RenderPassCmd.setStencilRef) {
                this.setStencilRef(f32[if32++]);
            } else if (cmd === RenderPassCmd.draw) {
                this.draw(u32[iu32++], u32[iu32++]);
            } else if (cmd === RenderPassCmd.drawIndexed) {
                this.drawIndexed(u32[iu32++], u32[iu32++]);
            } else if (cmd === RenderPassCmd.endPass) {
                this.endPass(gfxr[igfxr++] as GfxTexture | null);
                return;
            } else {
                throw new Error("Invalid execution");
            }
        }
    }

    public executeHostAccessPass(u32: Uint32Array, gfxr: GfxResource[], bufr: ArrayBufferView[]): void {
        let iu32 = 0, igfxr = 0, ibufr = 0;
        while (true) {
            const cmd = u32[iu32++] as HostAccessPassCmd;

            if (cmd === HostAccessPassCmd.uploadBufferData) {
                this.uploadBufferData(gfxr[igfxr++] as GfxBuffer, u32[iu32++], bufr[ibufr++] as Uint8Array, u32[iu32++], u32[iu32++]);
            } else if (cmd === HostAccessPassCmd.uploadTextureData) {
                // Implement inline to prevent allocation.
                const texture = gfxr[igfxr++] as GfxTexture;
                const firstMipLevel = u32[iu32++];
                const numMipLevels = u32[iu32++];

                const gl = this.gl;
                const { gl_texture, gl_target, pixelFormat, width, height, depth } = texture as GfxTextureP_GL;
                this._setActiveTexture(gl.TEXTURE0);
                this._currentTextures[0] = null;
                gl.bindTexture(gl_target, gl_texture);
                let w = width, h = height, d = depth;
                const maxMipLevel = firstMipLevel + numMipLevels;

                const isCompressed = this.isTextureFormatCompressed(pixelFormat);
                const is3D = gl_target === WebGL2RenderingContext.TEXTURE_3D || gl_target === WebGL2RenderingContext.TEXTURE_2D_ARRAY;
                const gl_format = this.translateTextureFormat(pixelFormat);

                for (let i = 0; i < maxMipLevel; i++) {
                    if (i >= firstMipLevel) {
                        const levelData = bufr[ibufr++] as ArrayBufferView;

                        if (is3D) {
                            if (isCompressed) {
                                gl.compressedTexSubImage3D(gl_target, i, 0, 0, 0, w, h, d, gl_format, levelData);
                            } else {
                                const gl_type = this.translateTextureType(pixelFormat);
                                gl.texSubImage3D(gl_target, i, 0, 0, 0, w, h, d, gl_format, gl_type, levelData);
                            }
                        } else {
                            if (isCompressed) {
                                gl.compressedTexSubImage2D(gl_target, i, 0, 0, w, h, gl_format, levelData);
                            } else {
                                const gl_type = this.translateTextureType(pixelFormat);
                                gl.texSubImage2D(gl_target, i, 0, 0, w, h, gl_format, gl_type, levelData);
                            }
                        }
                    }
        
                    w = Math.max((w / 2) | 0, 1);
                    h = Math.max((h / 2) | 0, 1);
                }
            } else if (cmd === HostAccessPassCmd.end) {
                return;
            } else {
                throw new Error("Invalid execution");
            }
        }
    }

    private _debugGroupStatisticsDrawCall(): void {
        for (let i = this._debugGroupStack.length - 1; i >= 0; i--)
            ++this._debugGroupStack[i].drawCallCount;
    }

    private _debugGroupStatisticsBufferUpload(): void {
        for (let i = this._debugGroupStack.length - 1; i >= 0; i--)
            ++this._debugGroupStack[i].bufferUploadCount;
    }

    private _debugGroupStatisticsTextureBind(): void {
        for (let i = this._debugGroupStack.length - 1; i >= 0; i--)
            ++this._debugGroupStack[i].textureBindCount;
    }

    private setRenderPassParameters(renderTarget: GfxRenderTarget, clearBits: GLenum, clearColorR: number, clearColorG: number, clearColorB: number, clearColorA: number, depthClearValue: number, stencilClearValue: number): void {
        const gl = this.gl;
        this._currentRenderTarget = renderTarget as GfxRenderTargetP_GL;
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._currentRenderTarget.gl_framebuffer);
        if (clearBits & WebGL2RenderingContext.COLOR_BUFFER_BIT) {
            gl.clearColor(clearColorR, clearColorG, clearColorB, clearColorA);
        }
        if (clearBits & WebGL2RenderingContext.DEPTH_BUFFER_BIT) {
            // GL clears obey the masks... bad API or worst API?
            gl.depthMask(true);
            this._currentMegaState.depthWrite = true;
            gl.clearDepth(depthClearValue);
        }
        if (clearBits & WebGL2RenderingContext.STENCIL_BUFFER_BIT)
            gl.clearStencil(stencilClearValue);
        if (clearBits !== 0)
            gl.clear(clearBits);
    }

    private _currentUniformBuffers: GfxBuffer[] = [];
    private _currentUniformBufferOffsets: number[] = [];
    private setBindings(bindingLayoutIndex: number, bindings_: GfxBindings, dynamicWordOffsetsCount: number, dynamicWordOffsets: Uint32Array, dynamicWordOffsetsStart: number): void {
        const gl = this.gl;

        assert(bindingLayoutIndex < this._currentPipeline.bindingLayouts.bindingLayoutTables.length);
        const bindingLayoutTable = this._currentPipeline.bindingLayouts.bindingLayoutTables[bindingLayoutIndex];

        const { uniformBufferBindings, samplerBindings } = bindings_ as GfxBindingsP_GL;
        assert(uniformBufferBindings.length === bindingLayoutTable.numUniformBuffers);
        assert(samplerBindings.length === bindingLayoutTable.numSamplers);
        assert(dynamicWordOffsetsCount === uniformBufferBindings.length);

        for (let i = 0; i < uniformBufferBindings.length; i++) {
            const binding = uniformBufferBindings[i];
            const index = bindingLayoutTable.firstUniformBuffer + i;
            const buffer = binding.buffer as GfxBufferP_GL;
            assert(buffer.usage === GfxBufferUsage.UNIFORM);
            const wordOffset = (binding.wordOffset + dynamicWordOffsets[dynamicWordOffsetsStart + i]);
            const byteOffset = wordOffset * 4;
            const byteSize = binding.wordCount * 4;
            if (buffer !== this._currentUniformBuffers[index] || byteOffset !== this._currentUniformBufferOffsets[index]) {
                const platformBufferByteOffset = byteOffset % buffer.pageByteSize;
                const platformBuffer = buffer.gl_buffer_pages[(byteOffset / buffer.pageByteSize) | 0];
                assert(byteOffset + byteSize < buffer.pageByteSize);
                gl.bindBufferRange(gl.UNIFORM_BUFFER, index, platformBuffer, platformBufferByteOffset, byteSize);
                this._currentUniformBuffers[index] = buffer;
                this._currentUniformBufferOffsets[index] = byteOffset;
                this._currentBoundBuffers[gl.UNIFORM_BUFFER] = platformBuffer;
            }
        }

        for (let i = 0; i < samplerBindings.length; i++) {
            const binding = samplerBindings[i];
            const samplerIndex = bindingLayoutTable.firstSampler + i;
            const gl_sampler = binding !== null && binding.sampler !== null ? getPlatformSampler(binding.sampler) : null;
            const gl_texture = binding !== null && binding.texture !== null ? getPlatformTexture(binding.texture) : null;

            if (this._currentSamplers[samplerIndex] !== gl_sampler) {
                gl.bindSampler(samplerIndex, gl_sampler);
                this._currentSamplers[samplerIndex] = gl_sampler;
            }

            if (this._currentTextures[samplerIndex] !== gl_texture) {
                this._setActiveTexture(gl.TEXTURE0 + samplerIndex);
                if (gl_texture !== null) {
                    const { gl_target } = (binding.texture as GfxTextureP_GL);
                    gl.bindTexture(gl_target, gl_texture);
                    this._debugGroupStatisticsTextureBind();
                } else {
                    // XXX(jstpierre): wtf do I do here? Maybe do nothing?
                }
                this._currentTextures[samplerIndex] = gl_texture;
            }
        }
    }

    private setViewport(w: number, h: number): void {
        const gl = this.gl;
        gl.viewport(0, 0, w, h);
    }

    private _setMegaState(newMegaState: GfxMegaStateDescriptor): void {
        applyMegaState(this.gl, this._currentMegaState, newMegaState);
    }

    private setPipeline(pipeline: GfxRenderPipeline): void {
        const gl = this.gl;
        this._currentPipeline = pipeline as GfxRenderPipelineP_GL;
        this._setMegaState(this._currentPipeline.megaState);
        // Hotpatch support.
        if (this._currentPipeline.program.deviceProgram.forceRecompile)
            this._currentPipeline.program.gl_program = this._currentPipeline.program.deviceProgram.compile(gl, this._programCache);
        this._useProgram(this._currentPipeline.program.gl_program);
    }

    private setInputState(inputState_: GfxInputState | null): void {
        const inputState = inputState_ as GfxInputStateP_GL;
        this._currentInputState = inputState;
        if (this._currentInputState !== null) {
            assert(this._currentPipeline.inputLayout === this._currentInputState.inputLayout);
            this._bindVAO(this._currentInputState.vao);
        } else {
            assert(this._currentPipeline.inputLayout === null);
            this._bindVAO(null);
        }
    }

    private setStencilRef(value: number): void {
        const gl = this.gl;
        gl.stencilFunc(this._currentMegaState.stencilCompare, value, 0xFF);
    }

    private draw(count: number, firstVertex: number): void {
        const gl = this.gl;
        const pipeline = this._currentPipeline;
        gl.drawArrays(pipeline.drawMode, firstVertex, count);
        this._debugGroupStatisticsDrawCall();
    }

    private drawIndexed(count: number, firstIndex: number): void {
        const gl = this.gl;
        const pipeline = this._currentPipeline;
        const inputState = this._currentInputState;
        const byteOffset = inputState.indexBufferByteOffset + firstIndex * inputState.indexBufferCompByteSize;
        gl.drawElements(pipeline.drawMode, count, inputState.indexBufferType, byteOffset);
        this._debugGroupStatisticsDrawCall();
    }

    private _passReadFramebuffer: WebGLFramebuffer | null = null;
    private _passDrawFramebuffer: WebGLFramebuffer | null = null;

    private endPass(resolveColorTo_: GfxTexture | null): void {
        if (resolveColorTo_ !== null) {
            const gl = this.gl;

            if (this._passReadFramebuffer === null) {
                this._passReadFramebuffer = gl.createFramebuffer();
                this._passDrawFramebuffer = gl.createFramebuffer();
            }

            const resolveColorTo = resolveColorTo_ as GfxTextureP_GL;
            const resolveColorFrom = this._currentRenderTarget.colorAttachment;

            assert(resolveColorFrom.width === resolveColorTo.width && resolveColorFrom.height === resolveColorTo.height);

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._passReadFramebuffer);
            gl.framebufferRenderbuffer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, resolveColorFrom.gl_renderbuffer);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._passDrawFramebuffer);
            gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resolveColorTo.gl_texture, 0);
            gl.blitFramebuffer(0, 0, resolveColorFrom.width, resolveColorFrom.height, 0, 0, resolveColorTo.width, resolveColorTo.height, gl.COLOR_BUFFER_BIT, gl.LINEAR);

            gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
            gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
        }
    }

    private uploadBufferData(buffer: GfxBuffer, dstByteOffset: number, data: Uint8Array, srcByteOffset: number, byteSize: number): void {
        const gl = this.gl;
        const { gl_target, byteSize: dstByteSize, pageByteSize: dstPageByteSize } = buffer as GfxBufferP_GL;
        if (gl_target === gl.UNIFORM_BUFFER)
            assert((dstByteOffset % dstPageByteSize) === 0);
        assert((dstByteOffset + byteSize) <= dstByteSize);

        const virtBufferByteOffsetEnd = dstByteOffset + byteSize;
        let virtBufferByteOffset = dstByteOffset;
        let physBufferByteOffset = dstByteOffset % dstPageByteSize;
        while (virtBufferByteOffset < virtBufferByteOffsetEnd) {
            this._bindBuffer(gl_target, getPlatformBuffer(buffer, virtBufferByteOffset));
            gl.bufferSubData(gl_target, physBufferByteOffset, data, srcByteOffset, Math.min(virtBufferByteOffsetEnd - virtBufferByteOffset, dstPageByteSize));
            virtBufferByteOffset += dstPageByteSize;
            physBufferByteOffset = 0;
            srcByteOffset += dstPageByteSize;
        }
        this._debugGroupStatisticsBufferUpload();
    }
    //#endregion
}

export function createSwapChainForWebGL2(gl: WebGL2RenderingContext): GfxSwapChain {
    return new GfxImplP_GL(gl);
}

export function gfxDeviceGetImpl(gfxDevice: GfxDevice): GfxImplP_GL {
    return gfxDevice as GfxImplP_GL;
}

interface TransitionExpando {
    _transitionDevice: GfxImplP_GL | undefined;
}

export function createTransitionDeviceForWebGL2(gl: WebGL2RenderingContext, state: RenderState): void {
    const expando = gl as any as TransitionExpando;
    assert(expando._transitionDevice === undefined)
    expando._transitionDevice = new GfxImplP_GL(gl, state.programCache, true);
}

// Transition API. This lets clients use some parts of the implementation, etc. while still using RenderState.
export function getTransitionDeviceForWebGL2(gl: WebGL2RenderingContext): GfxDevice {
    const expando = gl as any as TransitionExpando;
    return expando._transitionDevice;
}
