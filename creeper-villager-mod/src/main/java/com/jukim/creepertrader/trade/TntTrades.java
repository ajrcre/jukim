package com.jukim.creepertrader.trade;

import java.util.List;
import java.util.Optional;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.trading.MerchantOffer;
import net.minecraft.world.item.trading.MerchantOffers;

/** Factory for the Creeper Trader's TNT offers. */
public final class TntTrades {
	private static final int MAX_USES = 16;

	private TntTrades() {
	}

	public static List<SimpleTrade> providers() {
		return List.of(
			new SimpleTrade(Items.EMERALD, 1, Optional.empty(), 0, Items.TNT, 1, MAX_USES, 2),
			new SimpleTrade(Items.EMERALD, 5, Optional.empty(), 0, Items.TNT, 8, MAX_USES / 2, 5),
			new SimpleTrade(Items.GUNPOWDER, 4, Optional.of(Items.SAND), 4, Items.TNT, 1, MAX_USES, 1)
		);
	}

	public static void addAll(MerchantOffers offers) {
		for (TradeProvider provider : providers()) {
			MerchantOffer offer = provider.create();
			offers.add(offer);
		}
	}
}
