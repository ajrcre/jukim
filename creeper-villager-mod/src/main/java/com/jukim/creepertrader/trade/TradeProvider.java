package com.jukim.creepertrader.trade;

import net.minecraft.world.item.trading.MerchantOffer;

/** Strategy: each implementation knows how to build one trade offer. */
@FunctionalInterface
public interface TradeProvider {
	MerchantOffer create();
}
