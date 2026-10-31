package com.jukim.creepertrader.trade;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import net.minecraft.SharedConstants;
import net.minecraft.server.Bootstrap;
import net.minecraft.world.item.Items;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class TntTradesTest {
	@BeforeAll
	static void bootstrap() {
		SharedConstants.tryDetectVersion();
		Bootstrap.bootStrap();
	}

	@Test
	void everyTradeSellsTnt() {
		List<SimpleTrade> trades = TntTrades.providers();

		assertEquals(3, trades.size());
		trades.forEach(trade -> assertEquals(Items.TNT, trade.result()));
		trades.forEach(trade -> assertTrue(trade.maxUses() > 0));
	}

	@Test
	void emeraldTradesHaveExpectedPrices() {
		SimpleTrade single = TntTrades.providers().get(0);
		assertEquals(Items.EMERALD, single.costA());
		assertEquals(1, single.countA());
		assertEquals(1, single.resultCount());
		assertEquals(Optional.empty(), single.costB());

		SimpleTrade bulk = TntTrades.providers().get(1);
		assertEquals(Items.EMERALD, bulk.costA());
		assertEquals(5, bulk.countA());
		assertEquals(8, bulk.resultCount());
	}

	@Test
	void gunpowderTradeNeedsSandToo() {
		SimpleTrade trade = TntTrades.providers().get(2);

		assertEquals(Items.GUNPOWDER, trade.costA());
		assertEquals(4, trade.countA());
		assertEquals(Optional.of(Items.SAND), trade.costB());
		assertEquals(4, trade.countB());
	}
}
