package com.jukim.creepertrader.trade;

import java.util.Optional;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.trading.ItemCost;
import net.minecraft.world.item.trading.MerchantOffer;

/** A fixed trade: up to two costs for one result stack. */
public record SimpleTrade(Item costA, int countA, Optional<Item> costB, int countB, Item result, int resultCount, int maxUses, int xp)
		implements TradeProvider {

	private static final float PRICE_MULTIPLIER = 0.05F;

	@Override
	public MerchantOffer create() {
		return new MerchantOffer(
			new ItemCost(costA, countA),
			costB.map(item -> new ItemCost(item, countB)),
			new ItemStack(result, resultCount),
			maxUses,
			xp,
			PRICE_MULTIPLIER
		);
	}
}
