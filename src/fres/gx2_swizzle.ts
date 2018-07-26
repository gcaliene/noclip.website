
import { GX2SurfaceFormat, GX2TileMode, GX2AAMode } from './gx2_enum';
import { GX2Surface, DeswizzledSurface } from './gx2_surface';

import { WorkerPool, makeWorkerFromSource } from '../worker_util';

// This is all contained in one function in order to make it easier to Worker-ize.
function _deswizzle(inSurface: any, srcBuffer: ArrayBuffer, mipLevel: number): DeswizzledSurface {
    // TODO(jstpierre): Until I figure out how to make Parcel support
    // TypeScript const enum, I'm just going to duplicate the structures.
    // The web platform is pretty bad-ass in how it doesn't work.

    const enum GX2SurfaceFormat {
        FLAG_SRGB   = 0x0400,
        FLAG_SNORM  = 0x0200,
        FMT_MASK    = 0x003F,
        FMT_BC1     = 0x0031,
        FMT_BC3     = 0x0033,
        FMT_BC4     = 0x0034,
        FMT_BC5     = 0x0035,
    
        FMT_TCS_R8_G8_B8_A8 = 0x1a,
    
        BC1_UNORM   = FMT_BC1,
        BC1_SRGB    = FMT_BC1 | FLAG_SRGB,
        BC3_UNORM   = FMT_BC3,
        BC3_SRGB    = FMT_BC3 | FLAG_SRGB,
        BC4_UNORM   = FMT_BC4,
        BC4_SNORM   = FMT_BC4 | FLAG_SNORM,
        BC5_UNORM   = FMT_BC5,
        BC5_SNORM   = FMT_BC5 | FLAG_SNORM,
    
        TCS_R8_G8_B8_A8_UNORM = FMT_TCS_R8_G8_B8_A8,
        TCS_R8_G8_B8_A8_SRGB  = FMT_TCS_R8_G8_B8_A8 | FLAG_SRGB,
    }
    
    const enum GX2TileMode {
        _1D_TILED_THIN1 = 0x02,
        _2D_TILED_THIN1 = 0x04,
    }
    
    interface GX2Surface {
        format: GX2SurfaceFormat;
        tileMode: GX2TileMode;
        aaMode: GX2AAMode;
        swizzle: number;
        width: number;
        height: number;
        depth: number;
        pitch: number;
        numMips: number;

        texDataSize: number;
        mipDataSize: number;
        mipDataOffsets: number[];
    }

    const numPipes = 2;
    const numBanks = 4;
    const microTileWidth = 8;
    const microTileHeight = 8;
    const macroTileWidth = 8 * numBanks;
    const macroTileHeight = 8 * numPipes;
    const microTilePixels = microTileWidth * microTileHeight;

    const pipeInterleaveBytes = 256;
    const numPipeBits = 1;
    const numBankBits = 2;
    const numGroupBits = 8;
    const splitSize = 2048;

    function memcpy(dst: Uint8Array, dstOffs: number, src: ArrayBuffer, srcOffs: number, length: number) {
        dst.set(new Uint8Array(src, srcOffs, length), dstOffs);
    }

    function alignPow2(n: number): number {
        let x = 1;
        while (x < n)
            x *= 2;
        return x;
    }

    function computeSurfaceMipLevelTileMode(surface: GX2Surface, mipLevel: number): void {
        // Level starts at 0.
        if (mipLevel > 0) {
            surface.width = Math.max(alignPow2(surface.width >> mipLevel), 1);
            surface.pitch = Math.max(alignPow2(surface.pitch >> mipLevel), 1);
            surface.height = Math.max(alignPow2(surface.height >> mipLevel), 1);

            const numSamples = 1 << surface.aaMode;

            const bytesPerBlock = computeSurfaceBytesPerBlock(surface.format);
            const microTileThickness = computeSurfaceThickness(surface.tileMode);
            const bytesPerSample = bytesPerBlock * microTileThickness * microTilePixels;
            const microTileBytes = bytesPerSample * numSamples;
            const pitchAlignFactor = Math.max(pipeInterleaveBytes / microTileBytes, 1) | 0;
            const macroTileHeightBlocks = macroTileHeight * computeSurfaceBlockWidth(surface.format);

            if (surface.tileMode === GX2TileMode._2D_TILED_THIN1 && (surface.pitch < pitchAlignFactor * macroTileWidth || surface.height < macroTileHeightBlocks))
                surface.tileMode = GX2TileMode._1D_TILED_THIN1;
        }
    }

    function computePipeFromCoordWoRotation(x: number, y: number) {
        // NumPipes = 2
        const x3 = (x >>> 3) & 1;
        const y3 = (y >>> 3) & 1;
        const pipeBit0 = (y3 ^ x3);
        return (pipeBit0 << 0);
    }

    function computeBankFromCoordWoRotation(x: number, y: number) {
        const ty = (y / numPipes) | 0;

        const x3 = (x >>> 3) & 1;
        const x4 = (x >>> 4) & 1;
        const ty3 = (ty >>> 3) & 1;
        const ty4 = (ty >>> 4) & 1;

        const p0 = ty4 ^ x3;
        const p1 = ty3 ^ x4;
        return (p1 << 1) | (p0 << 0);
    }

    function computeSurfaceThickness(tileMode: GX2TileMode) {
        switch (tileMode) {
        case GX2TileMode._1D_TILED_THIN1:
        case GX2TileMode._2D_TILED_THIN1:
            return 1;
        }
    }

    function computeSurfaceBlockWidth(format: GX2SurfaceFormat) {
        switch (format & GX2SurfaceFormat.FMT_MASK) {
        case GX2SurfaceFormat.FMT_BC1:
        case GX2SurfaceFormat.FMT_BC3:
        case GX2SurfaceFormat.FMT_BC4:
        case GX2SurfaceFormat.FMT_BC5:
            return 4;
        default:
            return 1;
        }
    }

    function computeSurfaceBytesPerBlock(format: GX2SurfaceFormat) {
        switch (format & GX2SurfaceFormat.FMT_MASK) {
        case GX2SurfaceFormat.FMT_BC1:
        case GX2SurfaceFormat.FMT_BC4:
            return 8;
        case GX2SurfaceFormat.FMT_BC3:
        case GX2SurfaceFormat.FMT_BC5:
            return 16;

        // For non-block formats, a "block" is a pixel.
        case GX2SurfaceFormat.FMT_TCS_R8_G8_B8_A8:
            return 4;
        default:
            throw new Error(`Unsupported surface format ${format}`);
        }
    }

    function computePixelIndexWithinMicroTile(x: number, y: number, bytesPerBlock: number) {
        const x0 = (x >>> 0) & 1;
        const x1 = (x >>> 1) & 1;
        const x2 = (x >>> 2) & 1;
        const y0 = (y >>> 0) & 1;
        const y1 = (y >>> 1) & 1;
        const y2 = (y >>> 2) & 1;

        let pixelBits;
        if (bytesPerBlock === 8) {
            pixelBits = [y2, y1, x2, x1, y0, x0];
        } else if (bytesPerBlock === 16) {
            pixelBits = [y2, y1, x2, x1, x0, y0];
        } else if (bytesPerBlock === 4) {
            pixelBits = [y2, y1, y0, x2, x1, x0];
        } else {
            throw new Error("Invalid bpp");
        }

        const p5 = pixelBits[0];
        const p4 = pixelBits[1];
        const p3 = pixelBits[2];
        const p2 = pixelBits[3];
        const p1 = pixelBits[4];
        const p0 = pixelBits[5];
        return (p5 << 5) | (p4 << 4) | (p3 << 3) | (p2 << 2) | (p1 << 1) | (p0 << 0);
    }

    function computeSurfaceRotationFromTileMode(tileMode: GX2TileMode) {
        switch (tileMode) {
        case GX2TileMode._2D_TILED_THIN1:
            return numPipes * ((numBanks >> 1) - 1);
        default:
            throw new Error(`Unsupported tile mode ${tileMode}`);
        }
    }

    function computeTileModeAspectRatio(tileMode: GX2TileMode) {
        switch (tileMode) {
        case GX2TileMode._2D_TILED_THIN1:
            return 1;
        default:
            throw new Error(`Unsupported tile mode ${tileMode}`);
        }
    }

    function computeMacroTilePitch(tileMode: GX2TileMode) {
        return macroTileWidth / computeTileModeAspectRatio(tileMode);
    }

    function computeMacroTileHeight(tileMode: GX2TileMode) {
        return macroTileHeight / computeTileModeAspectRatio(tileMode);
    }

    function computeSurfaceAddrFromCoordMicroTiled(x: number, y: number, surface: GX2Surface) {
        // XXX(jstpierre): 3D Textures
        const slice = 0;

        const bytesPerBlock = computeSurfaceBytesPerBlock(surface.format);
        const microTileThickness = computeSurfaceThickness(surface.tileMode);
        const microTileBytes = bytesPerBlock * microTileThickness * microTilePixels;
        const microTilesPerRow = surface.pitch / microTileWidth;
        const microTileIndexX = (x / microTileWidth) | 0;
        const microTileIndexY = (y / microTileHeight) | 0;
        const microTileIndexZ = (slice / microTileThickness) | 0;

        const microTileOffset = microTileBytes * (microTileIndexX + microTileIndexY * microTilesPerRow);
        const sliceBytes = surface.pitch * surface.height * microTileThickness * bytesPerBlock;
        const sliceOffset = microTileIndexZ * sliceBytes;
        const pixelIndex = computePixelIndexWithinMicroTile(x, y, bytesPerBlock);
        const pixelOffset = bytesPerBlock * pixelIndex;

        return pixelOffset + microTileOffset + sliceOffset;
    }

    function computeSurfaceAddrFromCoordMacroTiled(x: number, y: number, surface: GX2Surface) {
        // XXX(jstpierre): AA textures
        const sample = 0;
        // XXX(jstpierre): 3D Textures
        const slice = 0;

        const numSamples = 1 << surface.aaMode;
        const pipeSwizzle = (surface.swizzle >> 8) & 0x01;
        const bankSwizzle = (surface.swizzle >> 9) & 0x03;

        const bytesPerBlock = computeSurfaceBytesPerBlock(surface.format);
        const microTileThickness = computeSurfaceThickness(surface.tileMode);
        const bytesPerSample = bytesPerBlock * microTileThickness * microTilePixels;
        const microTileBytes = bytesPerSample * numSamples;
        const isSamplesSplit = numSamples > 1 && (microTileBytes > splitSize);
        const samplesPerSlice = Math.max(isSamplesSplit ? (splitSize / bytesPerSample) : numSamples, 1);
        const numSampleSplits = isSamplesSplit ? (numSamples / samplesPerSlice) : 1;

        const rotation = computeSurfaceRotationFromTileMode(surface.tileMode);
        const macroTilePitch = computeMacroTilePitch(surface.tileMode);
        const macroTileHeight = computeMacroTileHeight(surface.tileMode);
        const groupMask = (1 << numGroupBits) - 1;

        const pixelIndex = computePixelIndexWithinMicroTile(x, y, bytesPerBlock);
        const pixelOffset = pixelIndex * bytesPerBlock;
        const sampleOffset = sample * (microTileBytes / numSamples);

        let elemOffset = pixelOffset + sampleOffset;
        let sampleSlice;
        if (isSamplesSplit) {
            const tileSliceBytes = microTileBytes / numSampleSplits;
            sampleSlice = (elemOffset / tileSliceBytes) | 0;
            elemOffset = elemOffset % tileSliceBytes;
        } else {
            sampleSlice = 0;
        }

        const pipe1 = computePipeFromCoordWoRotation(x, y);
        const bank1 = computeBankFromCoordWoRotation(x, y);
        let bankPipe = pipe1 + numPipes * bank1;
        const sliceIn = slice / (microTileThickness > 1 ? 4 : 1);
        const swizzle = pipeSwizzle + numPipes * bankSwizzle;
        bankPipe = bankPipe ^ (numPipes * sampleSlice * ((numBanks >> 1) + 1) ^ (swizzle + sliceIn * rotation));
        bankPipe = bankPipe % (numPipes * numBanks);
        const pipe = (bankPipe % numPipes) | 0;
        const bank = (bankPipe / numPipes) | 0;

        const sliceBytes = surface.height * surface.pitch * microTileThickness * bytesPerBlock * numSamples;
        const sliceOffset = sliceBytes * ((sampleSlice / microTileThickness) | 0);

        const numSwizzleBits = numBankBits + numPipeBits;

        const macroTilesPerRow = (surface.pitch / macroTilePitch) | 0;
        const macroTileBytes = (numSamples * microTileThickness * bytesPerBlock * macroTileHeight * macroTilePitch);
        const macroTileIndexX = (x / macroTilePitch) | 0;
        const macroTileIndexY = (y / macroTileHeight) | 0;
        const macroTileOffset = (macroTileIndexX + macroTilesPerRow * macroTileIndexY) * macroTileBytes;

        const totalOffset = (elemOffset + ((macroTileOffset + sliceOffset) >> numSwizzleBits));

        const offsetHigh = (totalOffset & ~groupMask) << numSwizzleBits;
        const offsetLow =  (totalOffset & groupMask);

        const pipeBits = pipe << (numGroupBits);
        const bankBits = bank << (numPipeBits + numGroupBits);
        const addr = (bankBits | pipeBits | offsetLow | offsetHigh);

        return addr;
    }

    // Have to spell this thing out the long way...
    // TODO(jstpierre): Fix this dumb-ness when we fix the worker stuff.
    const surface: GX2Surface = {
        format: inSurface.format,
        tileMode: inSurface.tileMode,
        aaMode: inSurface.aaMode,
        swizzle: inSurface.swizzle,
        width: inSurface.width,
        height: inSurface.height,
        depth: inSurface.depth,
        pitch: inSurface.pitch,
        numMips: inSurface.numMips,
        texDataSize: inSurface.texDataSize,
        mipDataSize: inSurface.mipDataSize,
        mipDataOffsets: inSurface.mipDataOffsets,
    };
    computeSurfaceMipLevelTileMode(surface, mipLevel);

    // For non-BC formats, "block" = 1 pixel.
    const blockSize = computeSurfaceBlockWidth(surface.format);

    const dstWidth = inSurface.width >>> mipLevel;
    const dstHeight = inSurface.height >>> mipLevel;
    let dstWidthBlocks = ((dstWidth + blockSize - 1) / blockSize) | 0;
    let dstHeightBlocks = ((dstHeight + blockSize - 1) / blockSize) | 0;

    const bytesPerBlock = computeSurfaceBytesPerBlock(surface.format);
    const dst = new Uint8Array(dstWidthBlocks * dstHeightBlocks * bytesPerBlock);

    for (let y = 0; y < dstHeightBlocks; y++) {
        for (let x = 0; x < dstWidthBlocks; x++) {
            let srcIdx;
            switch (surface.tileMode) {
            case GX2TileMode._1D_TILED_THIN1:
                srcIdx = computeSurfaceAddrFromCoordMicroTiled(x, y, surface);
                break;
            case GX2TileMode._2D_TILED_THIN1:
                srcIdx = computeSurfaceAddrFromCoordMacroTiled(x, y, surface);
                break;
            default:
                const tileMode_: GX2TileMode = (<GX2TileMode> surface.tileMode);
                throw new Error(`Unsupported tile mode ${tileMode_.toString(16)}`);
            }

            const dstIdx = (y * dstWidthBlocks + x) * bytesPerBlock;
            memcpy(dst, dstIdx, srcBuffer, srcIdx, bytesPerBlock);
        }
    }

    const pixels = dst.buffer;
    const width = dstWidth;
    const height = dstHeight;
    return { width, height, pixels };
}

interface DeswizzleRequest {
    surface: GX2Surface;
    buffer: ArrayBuffer;
    mipLevel: number;
    priority: number;
}

function deswizzleWorker(global: any): void {
    global.onmessage = (e: MessageEvent) => {
        const req: DeswizzleRequest = e.data;
        const deswizzledSurface = _deswizzle(req.surface, req.buffer, req.mipLevel);
        global.postMessage(deswizzledSurface, [deswizzledSurface.pixels]);
    };
}

function makeDeswizzleWorker(): Worker {
    return makeWorkerFromSource([
        _deswizzle.toString(),
        deswizzleWorker.toString(),
        'deswizzleWorker(this)',
    ]);
}

class Deswizzler {
    private pool: WorkerPool<DeswizzleRequest, DeswizzledSurface>;

    constructor() {
        this.pool = new WorkerPool<DeswizzleRequest, DeswizzledSurface>(makeDeswizzleWorker);
    }

    public deswizzle(surface: GX2Surface, buffer: ArrayBuffer, mipLevel: number): Promise<DeswizzledSurface> {
        const req: DeswizzleRequest = { surface, buffer, mipLevel, priority: mipLevel };
        return this.pool.execute(req);
    }

    public terminate() {
        this.pool.terminate();
    }

    public build() {
        this.pool.build();
    }
}

export const deswizzler: Deswizzler = new Deswizzler();
