
// Read DS Geometry Engine commands.

import { bgr5 as _bgr5 } from './nitro_tex';
import ArrayBufferSlice from '../ArrayBufferSlice';

// tslint:disable:variable-name

enum CmdType {
    MTX_RESTORE = 0x14,

    COLOR =       0x20,
    NORMAL =      0x21,
    TEXCOORD =    0x22,
    VTX_16 =      0x23,
    VTX_10 =      0x24,
    VTX_XY =      0x25,
    VTX_XZ =      0x26,
    VTX_YZ =      0x27,
    VTX_DIFF =    0x28,

    DIF_AMB =     0x30,

    BEGIN_VTXS =  0x40,
    END_VTXS =    0x41,
}

enum PolyType {
    TRIANGLES = 0,
    QUADS = 1,
    TRIANGLE_STRIP = 2,
    QUAD_STRIP = 3,
}

// 3 pos + 4 color + 2 uv
const VERTEX_SIZE = 9;
const VERTEX_BYTES = VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT;

const tmp = new Uint8Array(3);
export function bgr5(pixel: number): Color {
    _bgr5(tmp, 0, pixel);
    const r = tmp[0], g = tmp[1], b = tmp[2];
    return { r, g, b };
}

function cmd_MTX_RESTORE(ctx: ContextInternal) {
    // XXX: We don't implement the matrix stack yet.
    ctx.readParam();
}

function cmd_COLOR(ctx: ContextInternal) {
    const param = ctx.readParam();
    ctx.s_color = bgr5(param);
}

function cmd_NORMAL(ctx: ContextInternal) {
    const param = ctx.readParam();
}

function cmd_TEXCOORD(ctx: ContextInternal) {
    const param = ctx.readParam();
    let s = param & 0xFFFF;
    let t = param >> 16;

    // Sign extend.
    s = (s << 16 >> 16);
    t = (t << 16 >> 16);

    // Fixed point.
    s = s / 16.0;
    t = t / 16.0;

    ctx.s_texCoord = { s, t };
}

function cmd_VTX_16(ctx: ContextInternal) {
    const param1 = ctx.readParam();
    let x = (param1 & 0xFFFF);
    let y = (param1 >> 16) & 0xFFFF;
    const param2 = ctx.readParam();
    let z = (param2 & 0xFFFF);

    // Sign extend.
    x = (x << 16 >> 16);
    y = (y << 16 >> 16);
    z = (z << 16 >> 16);

    // Fixed point.
    x = x / 4096.0;
    y = y / 4096.0;
    z = z / 4096.0;

    ctx.vtx(x, y, z);
}

function cmd_VTX_10(ctx: ContextInternal) {
    const param = ctx.readParam();
    let x = (param & 0x03FF);
    let y = (param >> 10) & 0x03FF;
    let z = (param >> 20) & 0x03FF;

    // Sign extend.
    x = (x << 22 >> 22);
    y = (y << 22 >> 22);
    z = (z << 22 >> 22);

    // Fixed point.
    x = x / 64.0;
    y = y / 64.0;
    z = z / 64.0;

    ctx.vtx(x, y, z);
}

function cmd_VTX_XY(ctx: ContextInternal) {
    const param = ctx.readParam();
    let x = (param & 0xFFFF);
    let y = (param >> 16) & 0xFFFF;

    // Sign extend.
    x = (x << 16 >> 16);
    y = (y << 16 >> 16);

    // Fixed point.
    x = x / 4096.0;
    y = y / 4096.0;

    ctx.vtx(x, y, ctx.s_vtx.z);
}

function cmd_VTX_XZ(ctx: ContextInternal) {
    const param = ctx.readParam();
    let x = (param & 0xFFFF);
    let z = (param >> 16) & 0xFFFF;

    // Sign extend.
    x = (x << 16 >> 16);
    z = (z << 16 >> 16);

    // Fixed point.
    x = x / 4096.0;
    z = z / 4096.0;

    ctx.vtx(x, ctx.s_vtx.y, z);
}

function cmd_VTX_YZ(ctx: ContextInternal) {
    const param = ctx.readParam();
    let y = (param & 0xFFFF);
    let z = (param >> 16) & 0xFFFF;

    // Sign extend.
    y = (y << 16 >> 16);
    z = (z << 16 >> 16);

    // Fixed point.
    y = y / 4096.0;
    z = z / 4096.0;

    ctx.vtx(ctx.s_vtx.x, y, z);
}

function cmd_VTX_DIFF(ctx: ContextInternal) {
    const param = ctx.readParam();

    let x = (param & 0x03FF);
    let y = (param >> 10) & 0x03FF;
    let z = (param >> 20) & 0x03FF;

    // Sign extend.
    x = (x << 22 >> 22);
    y = (y << 22 >> 22);
    z = (z << 22 >> 22);

    // Fixed point.
    x = x / 4096.0;
    y = y / 4096.0;
    z = z / 4096.0;

    // Add on the difference...
    x += ctx.s_vtx.x;
    y += ctx.s_vtx.y;
    z += ctx.s_vtx.z;

    ctx.vtx(x, y, z);
}

function cmd_DIF_AMB(ctx: ContextInternal) {
    const param = ctx.readParam();
    // TODO: lighting
}

function cmd_BEGIN_VTXS(ctx: ContextInternal) {
    const param = ctx.readParam();
    const polyType = param & 0x03;
    ctx.s_polyType = polyType;
    ctx.vtxs = [];
}

export interface Packet {
    vertData: Float32Array;
    idxData: Uint16Array;
    polyType: PolyType;
}

function cmd_END_VTXS(ctx: ContextInternal) {
    const nVerts = ctx.vtxs.length;
    const vtxBuffer = new Float32Array(nVerts * VERTEX_SIZE);

    for (let i = 0; i < nVerts; i++) {
        const v = ctx.vtxs[i];
        const vtxArray = new Float32Array(vtxBuffer.buffer, i * VERTEX_BYTES, VERTEX_SIZE);

        vtxArray[0] = v.pos.x;
        vtxArray[1] = v.pos.y;
        vtxArray[2] = v.pos.z;

        vtxArray[3] = v.color.r / 0xFF;
        vtxArray[4] = v.color.g / 0xFF;
        vtxArray[5] = v.color.b / 0xFF;
        vtxArray[6] = ctx.alpha / 0xFF;

        vtxArray[7] = v.uv.s;
        vtxArray[8] = v.uv.t;
    }

    let idxBuffer;

    if (ctx.s_polyType === PolyType.TRIANGLES) {
        idxBuffer = new Uint16Array(nVerts);
        for (let i = 0; i < nVerts; i++)
            idxBuffer[i] = i;
    } else if (ctx.s_polyType === PolyType.QUADS) {
        idxBuffer = new Uint16Array(nVerts / 4 * 6);
        let dst = 0;
        for (let i = 0; i < nVerts; i += 4) {
            idxBuffer[dst++] = i + 0;
            idxBuffer[dst++] = i + 1;
            idxBuffer[dst++] = i + 2;
            idxBuffer[dst++] = i + 2;
            idxBuffer[dst++] = i + 3;
            idxBuffer[dst++] = i + 0;
        }
    } else if (ctx.s_polyType === PolyType.TRIANGLE_STRIP) {
        idxBuffer = new Uint16Array((nVerts - 2) * 3);
        let dst = 0;
        for (let i = 0; i < nVerts - 2; i++) {
            if (i % 2 === 0) {
                idxBuffer[dst++] = i + 0;
                idxBuffer[dst++] = i + 1;
                idxBuffer[dst++] = i + 2;
            } else {
                idxBuffer[dst++] = i + 1;
                idxBuffer[dst++] = i + 0;
                idxBuffer[dst++] = i + 2;
            }
        }
    } else if (ctx.s_polyType === PolyType.QUAD_STRIP) {
        idxBuffer = new Uint16Array(((nVerts - 2) / 2) * 6);
        let dst = 0;
        for (let i = 0; i < nVerts; i += 2) {
            idxBuffer[dst++] = i + 0;
            idxBuffer[dst++] = i + 1;
            idxBuffer[dst++] = i + 3;
            idxBuffer[dst++] = i + 3;
            idxBuffer[dst++] = i + 2;
            idxBuffer[dst++] = i + 0;
        }
    }

    const packet = { vertData: vtxBuffer, idxData: idxBuffer, polyType: ctx.s_polyType };
    ctx.packets.push(packet);
}

function runCmd(ctx: ContextInternal, cmd: number) {
    switch (cmd) {
    case 0: return;
    case CmdType.MTX_RESTORE: return cmd_MTX_RESTORE(ctx);
    case CmdType.COLOR:       return cmd_COLOR(ctx);
    case CmdType.NORMAL:      return cmd_NORMAL(ctx);
    case CmdType.TEXCOORD:    return cmd_TEXCOORD(ctx);
    case CmdType.VTX_16:      return cmd_VTX_16(ctx);
    case CmdType.VTX_10:      return cmd_VTX_10(ctx);
    case CmdType.VTX_XY:      return cmd_VTX_XY(ctx);
    case CmdType.VTX_XZ:      return cmd_VTX_XZ(ctx);
    case CmdType.VTX_YZ:      return cmd_VTX_YZ(ctx);
    case CmdType.VTX_DIFF:    return cmd_VTX_DIFF(ctx);
    case CmdType.DIF_AMB:     return cmd_DIF_AMB(ctx);
    case CmdType.BEGIN_VTXS:  return cmd_BEGIN_VTXS(ctx);
    case CmdType.END_VTXS:    return cmd_END_VTXS(ctx);
    default: console.warn("Missing command", cmd.toString(16));
    }
}

export interface Color {
    r: number;
    g: number;
    b: number;
}

export interface TexCoord {
    s: number;
    t: number;
}

interface Point {
    x: number;
    y: number;
    z: number;
}

interface Vertex {
    pos: Point;
    nrm: Point;
    color: Color;
    uv: TexCoord;
}

export class Context {
    public color: Color;
    public alpha: number;
}

class ContextInternal {
    public view: DataView;
    public offs: number = 0;

    public alpha: number;
    public s_color: Color;
    public s_texCoord: TexCoord;
    public s_vtx: Point;
    public s_nrm: Point;
    public s_polyType: PolyType;

    public vtxs: Vertex[];
    public packets: Packet[];

    constructor(buffer: ArrayBufferSlice, baseCtx: Context) {
        this.alpha = baseCtx.alpha;
        this.s_color = baseCtx.color;
        this.view = buffer.createDataView();
        this.s_texCoord = { s: 0, t: 0 };
        this.packets = [];
    }

    public readParam(): number {
        return this.view.getUint32((this.offs += 4) - 4, true);
    }
    public vtx(x: number, y: number, z: number) {
        this.s_vtx = { x, y, z };
        this.vtxs.push({ pos: this.s_vtx, nrm: this.s_nrm, color: this.s_color, uv: this.s_texCoord });
    }
}

export function readCmds(buffer: ArrayBufferSlice, baseCtx: Context) {
    const ctx = new ContextInternal(buffer, baseCtx);

    while (ctx.offs < buffer.byteLength) {
        // Commands are packed 4 at a time...
        const cmd0 = ctx.view.getUint8(ctx.offs++);
        const cmd1 = ctx.view.getUint8(ctx.offs++);
        const cmd2 = ctx.view.getUint8(ctx.offs++);
        const cmd3 = ctx.view.getUint8(ctx.offs++);

        runCmd(ctx, cmd0);
        runCmd(ctx, cmd1);
        runCmd(ctx, cmd2);
        runCmd(ctx, cmd3);
    }

    return ctx.packets;
}
