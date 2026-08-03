from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class StrikeData(BaseModel):
    strike: float
    callVolume: int = 0
    putVolume: int = 0
    totalVolume: int = 0
    callOi: int = 0
    putOi: int = 0
    totalOi: int = 0
    netOi: int = 0
    oiChange: int = 0
    impliedVol: Optional[float] = None
    settleVol: Optional[float] = None

class SDSide(BaseModel):
    width: float = 0.0
    strikeStart: float = 0.0
    strikeEnd: float = 0.0

class SDLevel(BaseModel):
    sd: int
    downside: SDSide
    upside: SDSide

class CmeSymbolData(BaseModel):
    symbol: str
    productName: str = ""
    title: Optional[str] = None
    futurePrice: float
    atmVolatility: Optional[float] = None
    dte: Optional[float] = None
    standardDeviations: List[SDLevel] = Field(default_factory=list)
    strikeData: List[StrikeData] = Field(default_factory=list)
    scrapedAt: Optional[str] = None

class StrikeDelta(BaseModel):
    strike: float
    callVolumeChange: int = 0
    putVolumeChange: int = 0
    totalVolumeChange: int = 0

class CmeDelta(BaseModel):
    previousScrapedAt: Optional[str] = None
    currentScrapedAt: Optional[str] = None
    strikeDeltas: List[StrikeDelta] = Field(default_factory=list)
    totalCallVolumeChange: int = 0
    totalPutVolumeChange: int = 0
    totalVolumeChange: int = 0
    priceChange: float = 0.0

class MarketStatePayload(BaseModel):
    timestamp: str
    symbols: Dict[str, CmeSymbolData] = Field(default_factory=dict)
    deltas: Dict[str, CmeDelta] = Field(default_factory=dict)
    isStale: bool = False
    lastScrapedAt: Optional[str] = None

class PriceCandle(BaseModel):
    timestamp: int  # Unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

class PriceResponse(BaseModel):
    symbol: str
    currentPrice: float
    change: float = 0.0
    changePercent: float = 0.0
    candles: List[PriceCandle] = Field(default_factory=list)
    lastUpdated: str
